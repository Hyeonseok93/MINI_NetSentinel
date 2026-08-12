import { IpSession, AnomalyEvent, TrafficHistoryPoint, ProcessTrafficPoint, GeoNode, BlacklistedIpItem } from '../types/network';

// Real Native Network Session interface returned from Rust/Electron backend
interface NativeIpSession {
  id: string;
  ip: string;
  domain?: string;
  country: string;
  country_code?: string;
  countryCode?: string;
  packets_in?: number;
  packetsIn?: number;
  packets_out?: number;
  packetsOut?: number;
  total_packets?: number;
  totalPackets?: number;
  bytes_in?: number;
  bytesIn?: number;
  bytes_out?: number;
  bytesOut?: number;
  total_bytes?: number;
  totalBytes?: number;
  last_seen?: string;
  lastSeen?: string;
  status: string;
  protocol: string;
  port: number;
  is_baseline?: boolean;
  isBaseline?: boolean;
}

export class RealPacketEngine {
  private sessions: Map<string, IpSession> = new Map();
  private trafficHistory: TrafficHistoryPoint[] = [];
  private anomalyEvents: AnomalyEvent[] = [];
  private listeners: (() => void)[] = [];
  private intervalId: number | null = null;
  private trustedIps: Set<string> = new Set([
    '8.8.8.8',
    '1.1.1.1',
    '192.168.1.1',
    '192.168.0.1',
    '192.168.219.1',
  ]);
  private confirmedNormalIps: Set<string> = new Set();
  private blockedIps: Set<string> = new Set();
  private blockedIpReasons: Map<string, string> = new Map();
  private seenIps: Set<string> = new Set();
  private monitoringConfig = {
    spikeThresholdPacketsPerSec: 40,
    notifyOnNewIp: true,
    autoBlockSuspicious: true,
    activeInterface: '',
  };
  private liveProcesses: ProcessTrafficPoint[] = [];
  private cumulativeProcessMap: Map<string, ProcessTrafficPoint> = new Map();
  private prevProcessStatsMap: Map<string, { bytesTotal: number; packetsIn: number; packetsOut: number }> = new Map();
  private cumulativeGeoMap: Map<string, GeoNode> = new Map();
  private cumulativeCountrySessionsMap: Map<string, Map<string, IpSession>> = new Map();
  private myPublicGeo: { country: string; countryCode: string } = { country: 'South Korea', countryCode: 'KR' };

  private sessionListeners: ((sessions: IpSession[]) => void)[] = [];
  private historyListeners: ((history: TrafficHistoryPoint[]) => void)[] = [];
  private anomalyListeners: ((anomalies: AnomalyEvent[]) => void)[] = [];
  private connectionStatus: {
    mode: 'electron' | 'vite-dev' | 'offline';
    ok: boolean;
    lastError: string | null;
    lastSuccessAt: string | null;
    captureMode: 'npcap' | 'netstat' | 'unknown';
  } = { mode: 'offline', ok: false, lastError: null, lastSuccessAt: null, captureMode: 'unknown' };

  constructor() {
    this.initHistory();
    this.detectMyPublicGeo();
  }

  public getConnectionStatus() {
    return { ...this.connectionStatus };
  }

  public applyMonitoringConfig(config: {
    spikeThresholdPacketsPerSec?: number;
    notifyOnNewIp?: boolean;
    autoBlockSuspicious?: boolean;
    activeInterface?: string;
  }) {
    if (typeof config.spikeThresholdPacketsPerSec === 'number') {
      this.monitoringConfig.spikeThresholdPacketsPerSec = config.spikeThresholdPacketsPerSec;
    }
    if (typeof config.notifyOnNewIp === 'boolean') {
      this.monitoringConfig.notifyOnNewIp = config.notifyOnNewIp;
    }
    if (typeof config.autoBlockSuspicious === 'boolean') {
      this.monitoringConfig.autoBlockSuspicious = config.autoBlockSuspicious;
    }
    if (typeof config.activeInterface === 'string') {
      this.monitoringConfig.activeInterface = config.activeInterface;
      const ipc = this.getElectronIpc();
      if (ipc && config.activeInterface) {
        ipc.invoke('set-capture-adapter', config.activeInterface).catch((err: any) => {
          console.warn('[packet-engine] set-capture-adapter failed:', err);
        });
      }
    }
  }

  private async notifyToast(title: string, body: string) {
    const ipc = this.getElectronIpc();
    if (!ipc) return;
    try {
      await ipc.invoke('show-toast', { title, body });
    } catch (err) {
      console.warn('[packet-engine] toast failed:', err);
    }
  }

  private async detectMyPublicGeo() {
    // Local-first: GeoLite2 mmdb (+ optional DNS for public IP). No remote geo APIs.
    try {
      const ipc = this.getElectronIpc();
      if (ipc) {
        const geo = await ipc.invoke('my-public-geo');
        if (geo?.country) {
          this.myPublicGeo = {
            country: geo.country,
            countryCode: geo.countryCode || geo.country_code || 'NET',
          };
          this.notify();
          return;
        }
      }
    } catch (err) {
      console.warn('[packet-engine] my-public-geo IPC failed:', err);
    }

    // Vite/dev fallback: timezone only (no third-party HTTP geo)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Seoul') || tz.includes('Korea')) {
      this.myPublicGeo = { country: 'South Korea', countryCode: 'KR' };
    }
  }

  public getMyPublicGeo() {
    return this.myPublicGeo;
  }

  private initHistory() {
    const now = new Date();
    for (let i = 15; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 1000);
      this.trafficHistory.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        packetsIn: 0,
        packetsOut: 0,
        bytesSec: 0,
        bytesIn: 0,
        bytesOut: 0,
      });
    }
  }

  public start(intervalMs: number = 1000) {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(() => {
      this.fetchLiveNativePackets();
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private ingestProcessPayload(processes: ProcessTrafficPoint[]) {
    const activeProcs = processes.filter((p) => p.totalPackets > 0);
    this.liveProcesses = activeProcs;

    processes.forEach((proc) => {
      const key = `${proc.processName}-${proc.pid}`;
      const prevStat = this.prevProcessStatsMap.get(key) || { bytesTotal: 0, packetsIn: 0, packetsOut: 0 };

      const deltaBytes = Math.max(0, proc.bytesTotal - prevStat.bytesTotal);
      const deltaPacketsIn = Math.max(0, proc.packetsIn - prevStat.packetsIn);
      const deltaPacketsOut = Math.max(0, proc.packetsOut - prevStat.packetsOut);

      this.prevProcessStatsMap.set(key, {
        bytesTotal: proc.bytesTotal,
        packetsIn: proc.packetsIn,
        packetsOut: proc.packetsOut,
      });

      if (!this.cumulativeProcessMap.has(key)) {
        this.cumulativeProcessMap.set(key, { ...proc });
      } else {
        const existing = this.cumulativeProcessMap.get(key)!;
        existing.bytesTotal += deltaBytes;
        existing.packetsIn += deltaPacketsIn;
        existing.packetsOut += deltaPacketsOut;
        existing.totalPackets = existing.packetsIn + existing.packetsOut;
      }
    });
  }

  private getElectronIpc(): { invoke: (channel: string, ...args: unknown[]) => Promise<any> } | null {
    if (typeof window === 'undefined') return null;
    if (window.electronIPC?.invoke) return window.electronIPC;
    return null;
  }

  private async fetchLiveNativePackets() {
    let rawNativeList: NativeIpSession[] = [];
    let gotPayload = false;

    // 1) Electron packaged / desktop bridge
    const ipc = this.getElectronIpc();
    if (ipc) {
      try {
        const data = await ipc.invoke('get-live-netstat');
        if (data && typeof data === 'object') {
          gotPayload = true;
          if (Array.isArray(data.sessions)) rawNativeList = data.sessions;
          if (Array.isArray(data.processes)) this.ingestProcessPayload(data.processes);

          if (data.ok === false) {
            this.connectionStatus = {
              mode: 'electron',
              ok: false,
              lastError: data.error || 'Electron telemetry returned ok:false',
              lastSuccessAt: this.connectionStatus.lastSuccessAt,
              captureMode: data.captureMode === 'npcap' ? 'npcap' : data.captureMode === 'netstat' ? 'netstat' : this.connectionStatus.captureMode,
            };
          } else {
            this.connectionStatus = {
              mode: 'electron',
              ok: true,
              lastError: data.captureError || null,
              lastSuccessAt: new Date().toISOString(),
              captureMode: data.captureMode === 'npcap' ? 'npcap' : 'netstat',
            };
          }
        }
      } catch (err: any) {
        this.connectionStatus = {
          mode: 'electron',
          ok: false,
          lastError: err?.message || String(err),
          lastSuccessAt: this.connectionStatus.lastSuccessAt,
          captureMode: this.connectionStatus.captureMode,
        };
        console.error('[packet-engine] Electron IPC failed:', err);
      }
    }

    // 2) Vite localhost middleware fallback (npm run dev)
    if (!gotPayload) {
      try {
        const response = await fetch('/api/live-netstat');
        if (response.ok) {
          const data = await response.json();
          gotPayload = true;
          if (Array.isArray(data.sessions)) rawNativeList = data.sessions;
          else if (Array.isArray(data)) rawNativeList = data;
          if (Array.isArray(data.processes)) this.ingestProcessPayload(data.processes);

          this.connectionStatus = {
            mode: 'vite-dev',
            ok: data.ok !== false,
            lastError: data.error || data.captureError || null,
            lastSuccessAt: data.ok === false ? this.connectionStatus.lastSuccessAt : new Date().toISOString(),
            captureMode: data.captureMode === 'npcap' ? 'npcap' : 'netstat',
          };
        } else {
          this.connectionStatus = {
            mode: 'offline',
            ok: false,
            lastError: `Vite /api/live-netstat HTTP ${response.status}`,
            lastSuccessAt: this.connectionStatus.lastSuccessAt,
            captureMode: this.connectionStatus.captureMode,
          };
        }
      } catch (err: any) {
        this.connectionStatus = {
          mode: 'offline',
          ok: false,
          lastError: err?.message || 'No Electron IPC and no Vite /api/live-netstat',
          lastSuccessAt: this.connectionStatus.lastSuccessAt,
          captureMode: this.connectionStatus.captureMode,
        };
      }
    }

    this.processRawNativeSessions(rawNativeList);
  }

  private processRawNativeSessions(rawNativeList: NativeIpSession[]) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let secPacketsIn = 0;
    let secPacketsOut = 0;
    let secBytes = 0;
    let secBytesIn = 0;
    let secBytesOut = 0;

    if (rawNativeList && rawNativeList.length > 0) {
      rawNativeList.forEach((native) => {
        const pIn = native.packets_in ?? native.packetsIn ?? 0;
        const pOut = native.packets_out ?? native.packetsOut ?? 0;
        const tPackets = native.total_packets ?? native.totalPackets ?? (pIn + pOut);

        const bIn = native.bytes_in ?? native.bytesIn ?? 0;
        const bOut = native.bytes_out ?? native.bytesOut ?? 0;
        const tBytes = native.total_bytes ?? native.totalBytes ?? (bIn + bOut);

        const countryCode = native.country_code ?? native.countryCode ?? 'NET';
        const lastSeen = native.last_seen ?? native.lastSeen ?? timeStr;
        const isBaselineFlag = native.is_baseline ?? native.isBaseline ?? false;

        const isBaseline = this.trustedIps.has(native.ip) || isBaselineFlag;
        const isConfirmedNormal = this.confirmedNormalIps.has(native.ip);
        const isBlocked = this.blockedIps.has(native.ip);
        const isFirstSeen = !this.seenIps.has(native.ip);
        this.seenIps.add(native.ip);

        let resolvedStatus = isBlocked
          ? 'blocked'
          : isBaseline || isConfirmedNormal
            ? 'normal'
            : (native.status as IpSession['status']);

        const packetsThisSec = pIn + pOut;
        if (
          !isBlocked &&
          !isBaseline &&
          !isConfirmedNormal &&
          packetsThisSec >= this.monitoringConfig.spikeThresholdPacketsPerSec
        ) {
          resolvedStatus = 'suspicious';
          this.triggerAnomaly({
            id: `anom-spike-${native.ip}-${Date.now()}`,
            ip: native.ip,
            timestamp: timeStr,
            type: 'TRAFFIC_SPIKE',
            severity: 'high',
            message: `Traffic spike on ${native.ip}: ${packetsThisSec} pkts/s (threshold ${this.monitoringConfig.spikeThresholdPacketsPerSec})`,
            resolved: false,
          });
        }

        if (isFirstSeen && !isBaseline && !isConfirmedNormal && !isBlocked) {
          if (resolvedStatus === 'normal' || !resolvedStatus) resolvedStatus = 'new';
          if (this.monitoringConfig.notifyOnNewIp) {
            void this.notifyToast(
              'New IP connection',
              `${native.ip} (${native.country || 'Unknown'}) port ${native.port}`
            );
          }
          this.triggerAnomaly({
            id: `anom-new-${native.ip}-${Date.now()}`,
            ip: native.ip,
            timestamp: timeStr,
            type: 'NEW_IP',
            severity: 'medium',
            message: `New connection to ${native.ip} (${native.country})`,
            resolved: false,
          });
        }

        const currentSession: IpSession = {
          id: native.id,
          ip: native.ip,
          domain: native.domain,
          country: native.country,
          countryCode,
          packetsIn: pIn,
          packetsOut: pOut,
          totalPackets: tPackets,
          bytesIn: bIn,
          bytesOut: bOut,
          totalBytes: tBytes,
          lastSeen,
          status: resolvedStatus,
          protocol: native.protocol as IpSession['protocol'],
          port: native.port,
          isBaseline,
        };

        this.sessions.set(native.ip, currentSession);

        const countryKey = currentSession.country || 'Unknown Location';
        if (!this.cumulativeCountrySessionsMap.has(countryKey)) {
          this.cumulativeCountrySessionsMap.set(countryKey, new Map());
        }
        const countrySessionMap = this.cumulativeCountrySessionsMap.get(countryKey)!;
        if (!countrySessionMap.has(native.ip)) {
          countrySessionMap.set(native.ip, { ...currentSession });
        } else {
          const existingSess = countrySessionMap.get(native.ip)!;
          existingSess.packetsIn += pIn;
          existingSess.packetsOut += pOut;
          existingSess.totalPackets += tPackets;
          existingSess.bytesIn += bIn;
          existingSess.bytesOut += bOut;
          existingSess.totalBytes += tBytes;
          existingSess.lastSeen = currentSession.lastSeen;
          existingSess.country = currentSession.country;
          existingSess.countryCode = currentSession.countryCode;
          existingSess.status = currentSession.status;
        }

        secPacketsIn += pIn;
        secPacketsOut += pOut;
        secBytesIn += bIn;
        secBytesOut += bOut;
        secBytes += tBytes;

        if (resolvedStatus === 'suspicious' && !isBaseline && !isConfirmedNormal) {
          this.triggerAnomaly({
            id: `anom-${native.ip}-${Date.now()}`,
            ip: native.ip,
            timestamp: timeStr,
            type: native.port === 4444 ? 'SUSPICIOUS_PORT' : 'TRAFFIC_SPIKE',
            severity: 'high',
            message: `Unrecognized connection to high-risk IP ${native.ip} (${native.country})`,
            resolved: false,
          });

          if (this.monitoringConfig.autoBlockSuspicious && !isBlocked) {
            void this.blockIp(native.ip, 'Auto-block: suspicious traffic');
          }
        }
      });
    }

    this.trafficHistory.push({
      time: timeStr,
      packetsIn: secPacketsIn,
      packetsOut: secPacketsOut,
      bytesSec: secBytes,
      bytesIn: secBytesIn,
      bytesOut: secBytesOut,
    });
    if (this.trafficHistory.length > 86400) {
      this.trafficHistory.shift();
    }

    this.notify();
  }

  private triggerAnomaly(event: AnomalyEvent) {
    const exists = this.anomalyEvents.some((e) => e.ip === event.ip && e.type === event.type && !e.resolved);
    if (!exists) {
      this.anomalyEvents.unshift(event);
      if (this.anomalyEvents.length > 50) {
        this.anomalyEvents.pop();
      }
    }
  }

  public resolveAnomaly(id: string) {
    const anom = this.anomalyEvents.find((a) => a.id === id);
    if (anom) {
      anom.resolved = true;
      this.notify();
    }
  }

  public removeTrustedIp(ip: string) {
    this.trustedIps.delete(ip);
    this.notify();
  }

  public addTrustedIp(ip: string, _domain?: string) {
    this.trustedIps.add(ip);
    this.notify();
  }

  public addVerifiedNormalIp(ip: string, _domain?: string) {
    this.confirmedNormalIps.add(ip);
    this.notify();
  }

  public resetNormalStatus(ip: string) {
    this.confirmedNormalIps.delete(ip);
    this.notify();
  }

  public getSessions(): IpSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.totalPackets - a.totalPackets);
  }

  public getTrafficHistory(): TrafficHistoryPoint[] {
    return this.trafficHistory.slice();
  }

  public getAnomalyEvents(): AnomalyEvent[] {
    return this.anomalyEvents;
  }

  public getBlacklistedIps(): BlacklistedIpItem[] {
    const list: BlacklistedIpItem[] = [];
    this.blockedIps.forEach((ip) => {
      list.push({
        ip,
        reason: this.blockedIpReasons.get(ip) || 'Blocked by Firewall Policy',
        blockedAt: Date.now(),
      });
    });
    return list;
  }

  public async blockIp(ip: string, reason: string = 'Manual Security Block') {
    this.blockedIps.add(ip);
    this.blockedIpReasons.set(ip, reason);
    const sess = this.sessions.get(ip);
    if (sess) {
      sess.status = 'blocked';
    }
    this.notify();

    const ipc = this.getElectronIpc();
    if (ipc) {
      try {
        const result = await ipc.invoke('firewall-block-ip', ip, reason);
        if (result && result.ok === false) {
          this.connectionStatus = {
            ...this.connectionStatus,
            lastError: result.error || 'Firewall block failed',
          };
          this.notify();
        }
        return result;
      } catch (err: any) {
        this.connectionStatus = {
          ...this.connectionStatus,
          lastError: err?.message || 'Firewall block IPC failed',
        };
        this.notify();
        return { ok: false, error: err?.message || String(err) };
      }
    }
    return { ok: false, error: 'Firewall IPC unavailable (UI-only block applied)' };
  }

  public async unblockIp(ip: string) {
    this.blockedIps.delete(ip);
    this.blockedIpReasons.delete(ip);
    const sess = this.sessions.get(ip);
    if (sess) {
      sess.status = 'normal';
    }
    this.notify();

    const ipc = this.getElectronIpc();
    if (ipc) {
      try {
        return await ipc.invoke('firewall-unblock-ip', ip);
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    }
    return { ok: false, error: 'Firewall IPC unavailable (UI-only unblock applied)' };
  }

  public async toggleBlockIp(ip: string) {
    if (this.blockedIps.has(ip)) {
      return this.unblockIp(ip);
    }
    return this.blockIp(ip, 'User Blocked');
  }

  public getProcessBreakdown(): ProcessTrafficPoint[] {
    return this.liveProcesses;
  }

  public getCumulativeProcessBreakdown(): ProcessTrafficPoint[] {
    return Array.from(this.cumulativeProcessMap.values()).sort((a, b) => b.bytesTotal - a.bytesTotal);
  }

  public clearCumulativeProcesses() {
    this.cumulativeProcessMap.clear();
    this.notify();
  }

  public getGroupedCumulativeProcesses(): import('../types/network').GroupedProcess[] {
    const map = new Map<string, import('../types/network').GroupedProcess>();
    this.cumulativeProcessMap.forEach((proc) => {
      if (!map.has(proc.processName)) {
        map.set(proc.processName, {
          processName: proc.processName,
          pids: [proc],
          packetsIn: proc.packetsIn,
          packetsOut: proc.packetsOut,
          totalPackets: proc.totalPackets,
          totalBytes: proc.bytesTotal,
          iconType: proc.iconType,
        });
      } else {
        const item = map.get(proc.processName)!;
        item.pids.push(proc);
        item.packetsIn += proc.packetsIn;
        item.packetsOut += proc.packetsOut;
        item.totalPackets += proc.totalPackets;
        item.totalBytes += proc.bytesTotal;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }

  public getGeoNodes(): GeoNode[] {
    const geoMap = new Map<string, { count: number; bytes: number; code: string; lat: number; lng: number }>();
    this.sessions.forEach((sess) => {
      const c = sess.country || 'Unknown Location';
      const code = sess.countryCode || (c === 'South Korea' ? 'KR' : c === 'United States' ? 'US' : 'NET');
      const existing = geoMap.get(c) || { count: 0, bytes: 0, code, lat: 0, lng: 0 };
      existing.count += 1;
      existing.bytes += sess.totalBytes;
      if (code && code !== 'NET') existing.code = code;
      geoMap.set(c, existing);
    });

    const result: GeoNode[] = [];
    geoMap.forEach((val, country) => {
      const nodeItem: GeoNode = {
        country,
        countryCode: val.code || 'NET',
        activeIpCount: val.count,
        totalBytes: val.bytes,
        lat: val.lat,
        lng: val.lng,
      };
      result.push(nodeItem);

      // Keep cumulative geo alive (was broken after Electron migration)
      if (!this.cumulativeGeoMap.has(country)) {
        this.cumulativeGeoMap.set(country, { ...nodeItem });
      } else {
        const cNode = this.cumulativeGeoMap.get(country)!;
        cNode.activeIpCount = Math.max(cNode.activeIpCount, val.count);
        cNode.totalBytes = Math.max(cNode.totalBytes, val.bytes);
        if (val.code && val.code !== 'NET') cNode.countryCode = val.code;
      }
    });

    return result.filter((n) => n.activeIpCount > 0).sort((a, b) => b.activeIpCount - a.activeIpCount);
  }

  public getCumulativeGeoNodes(): GeoNode[] {
    return Array.from(this.cumulativeGeoMap.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }

  public getCumulativeGeoSessions(country: string): IpSession[] {
    const map = this.cumulativeCountrySessionsMap.get(country);
    if (!map) return [];
    return Array.from(map.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }

  public clearCumulativeGeoNodes() {
    this.cumulativeGeoMap.clear();
    this.cumulativeCountrySessionsMap.clear();
    this.notify();
  }

  public subscribeSessions(fn: (sessions: IpSession[]) => void) {
    this.sessionListeners.push(fn);
    fn(this.getSessions());
    return () => {
      this.sessionListeners = this.sessionListeners.filter((l) => l !== fn);
    };
  }

  public subscribeHistory(fn: (history: TrafficHistoryPoint[]) => void) {
    this.historyListeners.push(fn);
    fn(this.getTrafficHistory());
    return () => {
      this.historyListeners = this.historyListeners.filter((l) => l !== fn);
    };
  }

  public subscribeAnomalies(fn: (anomalies: AnomalyEvent[]) => void) {
    this.anomalyListeners.push(fn);
    fn(this.getAnomalyEvents());
    return () => {
      this.anomalyListeners = this.anomalyListeners.filter((l) => l !== fn);
    };
  }

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    const activeSessions = this.getSessions();
    const activeHistory = this.getTrafficHistory();
    const activeAnomalies = this.getAnomalyEvents();

    this.sessionListeners.forEach((fn) => fn(activeSessions));
    this.historyListeners.forEach((fn) => fn(activeHistory));
    this.anomalyListeners.forEach((fn) => fn(activeAnomalies));
    this.listeners.forEach((fn) => fn());
  }

  public verifyAsNormal(ip: string) {
    this.confirmedNormalIps.add(ip);
    const sess = this.sessions.get(ip);
    if (sess) {
      sess.status = 'normal';
    }
    this.notify();
  }

  public toggleBaseline(ip: string) {
    if (this.trustedIps.has(ip)) {
      this.trustedIps.delete(ip);
    } else {
      this.trustedIps.add(ip);
    }

    const sess = this.sessions.get(ip);
    if (sess) {
      sess.isBaseline = this.trustedIps.has(ip);
      if (sess.isBaseline) {
        sess.status = 'normal';
      }
    }
    this.notify();
  }

  public getTrustedList() {
    const trusted: { ip: string; domain?: string; addedAt: string }[] = [];
    this.trustedIps.forEach((ip) => {
      const sess = this.sessions.get(ip);
      trusted.push({
        ip,
        domain: sess?.domain,
        addedAt: sess?.lastSeen || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });
    return trusted;
  }

  public getConfirmedNormalList() {
    const list: { ip: string; domain?: string; country: string; lastSeen: string }[] = [];
    this.confirmedNormalIps.forEach((ip) => {
      const sess = this.sessions.get(ip);
      if (sess && !sess.isBaseline) {
        list.push({
          ip,
          domain: sess.domain,
          country: sess.country,
          lastSeen: sess.lastSeen,
        });
      }
    });
    return list;
  }
}

export const realPacketEngine = new RealPacketEngine();
