import { IpSession, AnomalyEvent, TrafficHistoryPoint, ProcessTrafficPoint, GeoNode, BlacklistedIpItem, SpikeHistoryEntry } from '../types/network';
import { getElectronIpc } from '../utils/electronIpc';
import { normalizeIpv4 } from '../utils/ip';
import { groupProcessesByName, sortGroupedProcessesByBytesDesc } from '../utils/groupProcesses';
import { showAppToast } from '../ui/toastBus';
import {
  MAX_ANOMALY_EVENTS,
  MAX_TRAFFIC_HISTORY_UI,
  MAX_SEEN_IPS,
  DEFAULT_TRUSTED_IPS,
} from './packetEngine/constants';
import { extractNativeTraffic, normalizeProtocol, type NativeIpSession } from './packetEngine/nativeSession';
import { buildSpikeEntry, shouldRecordSpike } from './packetEngine/spikeHistory';
import { formatClock } from './packetEngine/time';

export class RealPacketEngine {
  private sessions: Map<string, IpSession> = new Map();
  private trafficHistory: TrafficHistoryPoint[] = [];
  private anomalyEvents: AnomalyEvent[] = [];
  private spikeHistory: SpikeHistoryEntry[] = [];
  private recentTotalPackets: number[] = [];
  private lastSpikeRecordAt = 0;
  private lastProcessDeltas: SpikeHistoryEntry['topProcesses'] = [];
  private intervalId: number | null = null;
  private trustedIps: Set<string> = new Set(DEFAULT_TRUSTED_IPS);
  /** Built-in defaults shown in Whitelist (same set as initial trustedIps). */
  private builtInTrustedIps: Set<string> = new Set(DEFAULT_TRUSTED_IPS);
  private confirmedNormalIps: Set<string> = new Set();
  private blockedIps: Set<string> = new Set();
  private blockedIpReasons: Map<string, string> = new Map();
  private blockedIpAt: Map<string, number> = new Map();
  private seenIps: Set<string> = new Set();
  private verifiedDomains: Map<string, string> = new Map();
  private trustedDomains: Map<string, string> = new Map();
  private monitoringConfig = {
    spikeThresholdPacketsPerSec: 40,
    historySpikePacketsPerSec: 200,
    notifyOnNewIp: false,
    autoBlockSuspicious: false,
    activeInterface: '',
  };
  private liveProcesses: ProcessTrafficPoint[] = [];
  private cumulativeProcessMap: Map<string, ProcessTrafficPoint> = new Map();
  private prevProcessStatsMap: Map<string, { bytesTotal: number; packetsIn: number; packetsOut: number }> = new Map();
  private cumulativeGeoMap: Map<string, GeoNode> = new Map();
  private cumulativeCountrySessionsMap: Map<string, Map<string, IpSession>> = new Map();
  private myPublicGeo: { country: string; countryCode: string } = { country: 'South Korea', countryCode: 'KR' };
  private suppressToastsUntil = 0;
  private lastToastAt = 0;
  private droppedToastCount = 0;
  private fetchInFlight = false;
  private listeners: (() => void)[] = [];
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
    historySpikePacketsPerSec?: number;
    notifyOnNewIp?: boolean;
    autoBlockSuspicious?: boolean;
    activeInterface?: string;
  }) {
    if (typeof config.spikeThresholdPacketsPerSec === 'number') {
      this.monitoringConfig.spikeThresholdPacketsPerSec = config.spikeThresholdPacketsPerSec;
    }
    if (typeof config.historySpikePacketsPerSec === 'number') {
      this.monitoringConfig.historySpikePacketsPerSec = Math.max(20, config.historySpikePacketsPerSec);
    }
    if (typeof config.notifyOnNewIp === 'boolean') {
      this.monitoringConfig.notifyOnNewIp = config.notifyOnNewIp;
    }
    if (typeof config.autoBlockSuspicious === 'boolean') {
      this.monitoringConfig.autoBlockSuspicious = config.autoBlockSuspicious;
    }
    if (typeof config.activeInterface === 'string') {
      this.monitoringConfig.activeInterface = config.activeInterface;
      const ipc = getElectronIpc();
      if (ipc && config.activeInterface) {
        ipc.invoke('set-capture-adapter', config.activeInterface).catch((err: any) => {
          console.warn('[packet-engine] set-capture-adapter failed:', err);
        });
      }
    }
  }

  private async notifyToast(title: string, body: string) {
    if (!this.monitoringConfig.notifyOnNewIp) return;
    const now = Date.now();
    if (now < this.suppressToastsUntil) {
      this.droppedToastCount += 1;
      return;
    }
    // Hard rate-limit: at most one in-app toast / 20s
    if (now - this.lastToastAt < 20_000) {
      this.droppedToastCount += 1;
      return;
    }
    this.lastToastAt = now;
    const extra =
      this.droppedToastCount > 0 ? ` (+${this.droppedToastCount} more suppressed)` : '';
    this.droppedToastCount = 0;
    showAppToast(title, `${body}${extra}`, 'info');
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
        time: formatClock(t, true),
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
    // First poll dumps every existing connection as "new" — mute OS toasts briefly
    this.suppressToastsUntil = Date.now() + 8000;
    this.droppedToastCount = 0;
    this.intervalId = window.setInterval(() => {
      void this.fetchLiveNativePackets();
    }, intervalMs);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.fetchInFlight = false;
  }

  private ingestProcessPayload(processes: ProcessTrafficPoint[]) {
    const activeProcs = processes.filter((p) => p.totalPackets > 0);
    this.liveProcesses = activeProcs;

    const deltas: SpikeHistoryEntry['topProcesses'] = [];
    processes.forEach((proc) => {
      const key = `${proc.processName}-${proc.pid}`;
      const prevStat = this.prevProcessStatsMap.get(key) || { bytesTotal: 0, packetsIn: 0, packetsOut: 0 };

      const deltaBytes = Math.max(0, proc.bytesTotal - prevStat.bytesTotal);
      const deltaPacketsIn = Math.max(0, proc.packetsIn - prevStat.packetsIn);
      const deltaPacketsOut = Math.max(0, proc.packetsOut - prevStat.packetsOut);
      const deltaPackets = deltaPacketsIn + deltaPacketsOut;

      this.prevProcessStatsMap.set(key, {
        bytesTotal: proc.bytesTotal,
        packetsIn: proc.packetsIn,
        packetsOut: proc.packetsOut,
      });

      if (deltaPackets > 0 || deltaBytes > 0) {
        deltas.push({
          processName: proc.processName,
          packets: deltaPackets,
          bytes: deltaBytes,
          iconType: proc.iconType,
        });
      }

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

    // Merge same processName for cleaner History attribution
    const byName = new Map<string, SpikeHistoryEntry['topProcesses'][number]>();
    deltas.forEach((d) => {
      const prev = byName.get(d.processName);
      if (!prev) byName.set(d.processName, { ...d });
      else {
        prev.packets += d.packets;
        prev.bytes += d.bytes;
      }
    });
    this.lastProcessDeltas = Array.from(byName.values())
      .sort((a, b) => b.packets - a.packets || b.bytes - a.bytes)
      .slice(0, 8);
  }

  private getElectronIpc(): { invoke: (channel: string, ...args: unknown[]) => Promise<any> } | null {
    return getElectronIpc();
  }

  private async fetchLiveNativePackets() {
    if (this.fetchInFlight) return;
    this.fetchInFlight = true;
    try {
      await this.fetchLiveNativePacketsInner();
    } finally {
      this.fetchInFlight = false;
    }
  }

  private async fetchLiveNativePacketsInner() {
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
    const timeStr = formatClock(new Date(), true);
    let secPacketsIn = 0;
    let secPacketsOut = 0;
    let secBytes = 0;
    let secBytesIn = 0;
    let secBytesOut = 0;
    const ipTickStats: Array<{
      ip: string;
      domain?: string;
      country: string;
      packets: number;
      bytes: number;
      processHint?: string;
    }> = [];

    if (rawNativeList && rawNativeList.length > 0) {
      rawNativeList.forEach((native) => {
        const extracted = extractNativeTraffic(native);
        const { pIn, pOut, tPackets, bIn, bOut, tBytes, countryCode } = extracted;
        const lastSeen = extracted.lastSeen || timeStr;

        if (pIn + pOut > 0 || tBytes > 0) {
          ipTickStats.push({
            ip: native.ip,
            domain: native.domain,
            country: native.country || '—',
            packets: pIn + pOut,
            bytes: tBytes,
            processHint: (native as any).processName || (native as any).process_name,
          });
        }

        // ONLY user (or built-in) whitelist — never silent isSafe from telemetry
        const isBaseline = this.trustedIps.has(native.ip);
        const isConfirmedNormal = this.confirmedNormalIps.has(native.ip);
        const isBlocked = this.blockedIps.has(native.ip);
        const isFirstSeen = !this.seenIps.has(native.ip);
        this.seenIps.add(native.ip);

        // Unknown IPs stay "new" until Verify Normal / Trust / Block.
        let resolvedStatus: IpSession['status'] = isBlocked
          ? 'blocked'
          : isBaseline || isConfirmedNormal
            ? 'normal'
            : 'new';

        const packetsThisSec = pIn + pOut;
        const isTrafficSpike =
          packetsThisSec >= this.monitoringConfig.spikeThresholdPacketsPerSec;
        const isThreatHeuristic = native.status === 'suspicious';
        if (!isBlocked && !isBaseline && !isConfirmedNormal && (isTrafficSpike || isThreatHeuristic)) {
          resolvedStatus = 'suspicious';
          if (isTrafficSpike) {
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
        }

        if (isFirstSeen && !isBaseline && !isConfirmedNormal && !isBlocked) {
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
          protocol: normalizeProtocol(native.protocol),
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
          if (native.port === 4444) {
            this.triggerAnomaly({
              id: `anom-port-${native.ip}-${Date.now()}`,
              ip: native.ip,
              timestamp: timeStr,
              type: 'SUSPICIOUS_PORT',
              severity: 'high',
              message: `Unrecognized connection to high-risk IP ${native.ip} (${native.country}) on port 4444`,
              resolved: false,
            });
          }

          // Auto-block only for threat heuristics — never for traffic-spike alone
          if (this.monitoringConfig.autoBlockSuspicious && !isBlocked && isThreatHeuristic) {
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

    this.maybeRecordSpikeHistory({
      timeStr,
      secPacketsIn,
      secPacketsOut,
      secBytes,
      ipTickStats,
    });

    this.pruneSeenIpsIfNeeded();
    this.notify();
  }

  private pruneSeenIpsIfNeeded() {
    if (this.seenIps.size <= MAX_SEEN_IPS) return;
    const keep = new Set<string>();
    this.sessions.forEach((_s, ip) => keep.add(ip));
    this.trustedIps.forEach((ip) => keep.add(ip));
    this.confirmedNormalIps.forEach((ip) => keep.add(ip));
    this.blockedIps.forEach((ip) => keep.add(ip));
    this.seenIps = keep;
  }

  private maybeRecordSpikeHistory(args: {
    timeStr: string;
    secPacketsIn: number;
    secPacketsOut: number;
    secBytes: number;
    ipTickStats: SpikeHistoryEntry['topIps'];
  }) {
    const totalPkts = args.secPacketsIn + args.secPacketsOut;
    this.recentTotalPackets.push(totalPkts);
    if (this.recentTotalPackets.length > 60) this.recentTotalPackets.shift();

    const last = this.spikeHistory[0];
    const lastEntryTotal = last ? last.packetsIn + last.packetsOut : null;
    const now = Date.now();

    if (
      !shouldRecordSpike({
        totalPkts,
        recentTotals: this.recentTotalPackets,
        historyThreshold: this.monitoringConfig.historySpikePacketsPerSec,
        lastRecordAt: this.lastSpikeRecordAt,
        lastEntryTotal,
        now,
      })
    ) {
      return;
    }

    const entry = buildSpikeEntry({
      now,
      timeStr: args.timeStr,
      secPacketsIn: args.secPacketsIn,
      secPacketsOut: args.secPacketsOut,
      secBytes: args.secBytes,
      totalPkts,
      ipTickStats: args.ipTickStats,
      liveProcesses: this.liveProcesses,
      lastProcessDeltas: this.lastProcessDeltas,
    });

    this.spikeHistory.unshift(entry);
    if (this.spikeHistory.length > 200) this.spikeHistory.pop();
    this.lastSpikeRecordAt = now;
  }

  private triggerAnomaly(event: AnomalyEvent) {
    // Dedup by ip+type whether open or acknowledged — Delete is required to allow a fresh event
    const exists = this.anomalyEvents.some((e) => e.ip === event.ip && e.type === event.type);
    if (!exists) {
      this.anomalyEvents.unshift(event);
      if (this.anomalyEvents.length > MAX_ANOMALY_EVENTS) {
        this.anomalyEvents.length = MAX_ANOMALY_EVENTS;
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

  public deleteAnomaly(id: string) {
    const before = this.anomalyEvents.length;
    this.anomalyEvents = this.anomalyEvents.filter((a) => a.id !== id);
    if (this.anomalyEvents.length !== before) {
      this.notify();
    }
  }

  public clearResolvedAnomalies() {
    const before = this.anomalyEvents.length;
    this.anomalyEvents = this.anomalyEvents.filter((a) => !a.resolved);
    if (this.anomalyEvents.length !== before) {
      this.notify();
    }
  }

  /**
   * Wipe monitoring classifications so IPs are re-learned from scratch.
   * Keeps built-in trusted defaults. Attempts firewall unblock for every blocked IP.
   */
  public async resetAllMonitoringState() {
    const blocked = Array.from(this.blockedIps);
    for (const ip of blocked) {
      try {
        await this.unblockIp(ip);
      } catch {
        // continue — UI state still cleared below
      }
    }

    this.blockedIps.clear();
    this.blockedIpReasons.clear();
    this.blockedIpAt.clear();
    this.confirmedNormalIps.clear();
    this.verifiedDomains.clear();
    this.seenIps.clear();
    this.anomalyEvents = [];
    this.spikeHistory = [];
    this.recentTotalPackets = [];
    this.lastSpikeRecordAt = 0;
    this.lastProcessDeltas = [];

    this.trustedIps = new Set(this.builtInTrustedIps);
    this.trustedDomains.clear();

    this.sessions.forEach((sess, ip) => {
      if (this.trustedIps.has(ip)) {
        sess.isBaseline = true;
        sess.status = 'normal';
      } else {
        sess.isBaseline = false;
        sess.status = 'new';
      }
    });

    this.cumulativeProcessMap.clear();
    this.prevProcessStatsMap.clear();
    this.cumulativeGeoMap.clear();
    this.cumulativeCountrySessionsMap.clear();
    this.liveProcesses = [];
    this.trafficHistory = [];
    this.initHistory();

    // Mute new-IP toasts during the first re-learn burst
    this.suppressToastsUntil = Date.now() + 8000;
    this.droppedToastCount = 0;

    this.notify();
  }

  public removeTrustedIp(ip: string) {
    this.trustedIps.delete(ip);
    this.trustedDomains.delete(ip);
    const sess = this.sessions.get(ip);
    if (sess) {
      sess.isBaseline = false;
      if (this.blockedIps.has(ip)) {
        sess.status = 'blocked';
      } else if (this.confirmedNormalIps.has(ip)) {
        sess.status = 'normal';
      } else {
        sess.status = 'new';
      }
    }
    this.notify();
  }

  public addTrustedIp(ip: string, domain?: string) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    this.trustedIps.add(safeIp);
    if (domain) this.trustedDomains.set(safeIp, domain);
    // Keep verified membership so Untrust can return to Verified (not NEW)
    const sess = this.sessions.get(safeIp);
    if (sess) {
      sess.isBaseline = true;
      sess.status = this.blockedIps.has(safeIp) ? 'blocked' : 'normal';
      if (domain) sess.domain = domain;
    }
    this.notify();
  }

  public addVerifiedNormalIp(ip: string, domain?: string) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    this.confirmedNormalIps.add(safeIp);
    if (domain) this.verifiedDomains.set(safeIp, domain);
    this.trustedIps.delete(safeIp);
    this.trustedDomains.delete(safeIp);
    const sess = this.sessions.get(safeIp);
    if (sess) {
      sess.isBaseline = false;
      sess.status = this.blockedIps.has(safeIp) ? 'blocked' : 'normal';
      if (domain) sess.domain = domain;
    }
    this.notify();
  }

  public resetNormalStatus(ip: string) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    this.confirmedNormalIps.delete(safeIp);
    this.verifiedDomains.delete(safeIp);
    const sess = this.sessions.get(safeIp);
    if (sess && !this.trustedIps.has(safeIp) && !this.blockedIps.has(safeIp)) {
      sess.status = 'new';
      sess.isBaseline = false;
    }
    this.notify();
  }

  /** Clear user-added Trusted entries; keep built-in defaults. */
  public clearTrustedList() {
    const keep = new Set(this.builtInTrustedIps);
    Array.from(this.trustedIps).forEach((ip) => {
      if (!keep.has(ip)) this.removeTrustedIp(ip);
    });
    this.notify();
  }

  /** Clear all Verified Normal entries (back to NEW unless Trusted/Blocked). */
  public clearVerifiedList() {
    Array.from(this.confirmedNormalIps).forEach((ip) => {
      this.resetNormalStatus(ip);
    });
    this.verifiedDomains.clear();
    this.notify();
  }

  /** Unblock every blacklisted IP (firewall + UI). */
  public async clearBlacklist() {
    const blocked = Array.from(this.blockedIps);
    for (const ip of blocked) {
      try {
        await this.unblockIp(ip);
      } catch {
        // continue
      }
    }
    this.notify();
  }

  public getSessions(): IpSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.totalPackets - a.totalPackets);
  }

  public getTrafficHistory(maxPoints: number = MAX_TRAFFIC_HISTORY_UI): TrafficHistoryPoint[] {
    if (this.trafficHistory.length <= maxPoints) return this.trafficHistory.slice();
    return this.trafficHistory.slice(-maxPoints);
  }

  public getAnomalyEvents(): AnomalyEvent[] {
    return this.anomalyEvents;
  }

  public getSpikeHistory(): SpikeHistoryEntry[] {
    return this.spikeHistory.slice();
  }

  public clearSpikeHistory() {
    if (this.spikeHistory.length === 0) return;
    this.spikeHistory = [];
    this.notify();
  }

  public deleteSpikeHistory(id: string) {
    const before = this.spikeHistory.length;
    this.spikeHistory = this.spikeHistory.filter((e) => e.id !== id);
    if (this.spikeHistory.length !== before) this.notify();
  }

  public getBlacklistedIps(): BlacklistedIpItem[] {
    const list: BlacklistedIpItem[] = [];
    this.blockedIps.forEach((ip) => {
      list.push({
        ip,
        reason: this.blockedIpReasons.get(ip) || 'Blocked by Firewall Policy',
        blockedAt: this.blockedIpAt.get(ip) || Date.now(),
      });
    });
    return list;
  }

  public async blockIp(ip: string, reason: string = 'Manual Security Block') {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) {
      this.connectionStatus = {
        ...this.connectionStatus,
        lastError: `Invalid IPv4 address: ${ip}`,
      };
      this.notify();
      return { ok: false, error: `Invalid IPv4 address: ${ip}` };
    }
    const safeReason = String(reason || 'Manual Security Block').slice(0, 120);

    const applyLocalBlock = () => {
      this.blockedIps.add(safeIp);
      this.blockedIpReasons.set(safeIp, safeReason);
      if (!this.blockedIpAt.has(safeIp)) {
        this.blockedIpAt.set(safeIp, Date.now());
      }
      const sess = this.sessions.get(safeIp);
      if (sess) sess.status = 'blocked';
    };

    const rollbackLocalBlock = () => {
      this.blockedIps.delete(safeIp);
      this.blockedIpReasons.delete(safeIp);
      this.blockedIpAt.delete(safeIp);
      const sess = this.sessions.get(safeIp);
      if (sess) {
        if (this.trustedIps.has(safeIp)) {
          sess.isBaseline = true;
          sess.status = 'normal';
        } else if (this.confirmedNormalIps.has(safeIp)) {
          sess.isBaseline = false;
          sess.status = 'normal';
        } else {
          sess.isBaseline = false;
          sess.status = 'new';
        }
      }
    };

    applyLocalBlock();
    this.notify();

    const ipc = this.getElectronIpc();
    if (ipc) {
      try {
        const result = await ipc.invoke('firewall-block-ip', safeIp, safeReason);
        if (result && result.ok === false) {
          rollbackLocalBlock();
          this.connectionStatus = {
            ...this.connectionStatus,
            lastError: result.error || 'Firewall block failed',
          };
          this.notify();
        }
        return result;
      } catch (err: any) {
        rollbackLocalBlock();
        this.connectionStatus = {
          ...this.connectionStatus,
          lastError: err?.message || 'Firewall block IPC failed',
        };
        this.notify();
        return { ok: false, error: err?.message || String(err) };
      }
    }
    // No IPC (browser/dev): keep UI-only block
    return { ok: false, error: 'Firewall IPC unavailable (UI-only block applied)' };
  }

  public async unblockIp(ip: string) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) {
      return { ok: false, error: `Invalid IPv4 address: ${ip}` };
    }
    this.blockedIps.delete(safeIp);
    this.blockedIpReasons.delete(safeIp);
    this.blockedIpAt.delete(safeIp);
    const sess = this.sessions.get(safeIp);
    if (sess) {
      if (this.trustedIps.has(safeIp)) {
        sess.isBaseline = true;
        sess.status = 'normal';
      } else if (this.confirmedNormalIps.has(safeIp)) {
        sess.isBaseline = false;
        sess.status = 'normal';
      } else {
        sess.isBaseline = false;
        sess.status = 'new';
      }
    }
    this.notify();

    const ipc = this.getElectronIpc();
    if (ipc) {
      try {
        return await ipc.invoke('firewall-unblock-ip', safeIp);
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    }
    return { ok: false, error: 'Firewall IPC unavailable (UI-only unblock applied)' };
  }

  public async toggleBlockIp(ip: string) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return { ok: false, error: `Invalid IPv4 address: ${ip}` };
    if (this.blockedIps.has(safeIp)) {
      return this.unblockIp(safeIp);
    }
    return this.blockIp(safeIp, 'User Blocked');
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
    return sortGroupedProcessesByBytesDesc(
      groupProcessesByName(Array.from(this.cumulativeProcessMap.values()))
    );
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

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public verifyAsNormal(ip: string) {
    this.addVerifiedNormalIp(ip);
  }

  public toggleBaseline(ip: string) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    if (this.trustedIps.has(safeIp)) {
      this.trustedIps.delete(safeIp);
      this.trustedDomains.delete(safeIp);
      const sess = this.sessions.get(safeIp);
      if (sess) {
        sess.isBaseline = false;
        if (this.blockedIps.has(safeIp)) {
          sess.status = 'blocked';
        } else if (this.confirmedNormalIps.has(safeIp)) {
          sess.status = 'normal';
        } else {
          sess.status = 'new';
        }
      }
    } else {
      this.trustedIps.add(safeIp);
      const sess = this.sessions.get(safeIp);
      if (sess) {
        sess.isBaseline = true;
        sess.status = this.blockedIps.has(safeIp) ? 'blocked' : 'normal';
        if (sess.domain) this.trustedDomains.set(safeIp, sess.domain);
      }
    }
    this.notify();
  }

  public getTrustedList() {
    const trusted: { ip: string; domain?: string; addedAt: string; note?: string }[] = [];
    this.trustedIps.forEach((ip) => {
      if (this.blockedIps.has(ip)) return; // blocked rows use Blacklist hub
      const sess = this.sessions.get(ip);
      trusted.push({
        ip,
        domain: sess?.domain || this.trustedDomains.get(ip),
        addedAt: sess?.lastSeen || formatClock(new Date(), false),
        note: this.builtInTrustedIps.has(ip) ? 'Built-in default' : undefined,
      });
    });
    return trusted;
  }

  public getConfirmedNormalList() {
    const list: { ip: string; domain?: string; country: string; lastSeen: string }[] = [];
    this.confirmedNormalIps.forEach((ip) => {
      if (this.trustedIps.has(ip)) return; // currently elevated to Trusted
      if (this.blockedIps.has(ip)) return;
      const sess = this.sessions.get(ip);
      list.push({
        ip,
        domain: sess?.domain || this.verifiedDomains.get(ip),
        country: sess?.country || '—',
        lastSeen: sess?.lastSeen || '—',
      });
    });
    return list;
  }
}

export const realPacketEngine = new RealPacketEngine();
