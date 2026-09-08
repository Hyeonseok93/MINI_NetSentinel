import { IpSession, AnomalyEvent, TrafficHistoryPoint, ProcessTrafficPoint, GeoNode, BlacklistedIpItem, SpikeHistoryEntry } from '../types/network';
import { getElectronIpc, isElectronShell, warnIpcUnavailable } from '../utils/electronIpc';
import { groupProcessesByName, sortGroupedProcessesByBytesDesc } from '../utils/groupProcesses';
import {
  MAX_TRAFFIC_HISTORY_UI,
  MAX_SEEN_IPS,
} from './packetEngine/constants';
import { type NativeIpSession } from './packetEngine/nativeSession';
import { formatClock } from './packetEngine/time';
import { ingestNativeSessionList } from './packetEngine/sessionIngest';
import { ToastGate } from './packetEngine/toastGate';
import { AnomalyStore } from './packetEngine/anomalyStore';
import { GeoStore } from './packetEngine/geoStore';
import { FirewallStore, type FirewallDeps } from './packetEngine/firewallStore';
import { ProcessAccumulator } from './packetEngine/processAccumulator';
import { SessionHistoryStore } from './packetEngine/sessionHistoryStore';
import { TrustStore, type TrustStoreDeps } from './packetEngine/trustStore';
import { SpikeHistoryStore } from './packetEngine/spikeHistoryStore';
import {
  loadPersistedMembership,
  savePersistedMembership,
  type PersistedBlocked,
  type PersistedTrusted,
} from './packetEngine/membershipPersistence';
import { normalizeIpv4 } from '../utils/ip';

export class RealPacketEngine {
  private sessions: Map<string, IpSession> = new Map();
  private trafficHistory: TrafficHistoryPoint[] = [];
  private spikes = new SpikeHistoryStore();
  private intervalId: number | null = null;
  private trust = new TrustStore();
  private seenIps: Set<string> = new Set();
  private monitoringConfig = {
    spikeThresholdPacketsPerSec: 40,
    historySpikePacketsPerSec: 200,
    notifyOnNewIp: false,
    activeInterface: '',
  };
  private toast = new ToastGate();
  private anomalies = new AnomalyStore();
  private geo = new GeoStore();
  private firewall = new FirewallStore();
  private processes = new ProcessAccumulator();
  private sessionHistory = new SessionHistoryStore();
  private fetchInFlight = false;
  private listeners: (() => void)[] = [];
  private membershipHydrated = false;
  private connectionStatus: {
    mode: 'electron' | 'vite-dev' | 'offline';
    ok: boolean;
    lastError: string | null;
    lastSuccessAt: string | null;
    captureMode: 'npcap' | 'netstat' | 'unknown';
  } = { mode: 'offline', ok: false, lastError: null, lastSuccessAt: null, captureMode: 'unknown' };

  constructor() {
    this.initHistory();
    void this.bootstrapMembership();
    void this.geo.detectMyPublicGeo(() => this.notify());
  }

  private async bootstrapMembership() {
    try {
      const data = await loadPersistedMembership();
      for (const entry of data.trusted) {
        if (this.trust.builtInTrustedIps.has(entry.ip)) continue;
        this.trust.trustedIps.add(entry.ip);
        if (entry.domain) this.trust.trustedDomains.set(entry.ip, entry.domain);
      }
      for (const entry of data.verified) {
        this.trust.confirmedNormalIps.add(entry.ip);
        if (entry.domain) this.trust.verifiedDomains.set(entry.ip, entry.domain);
      }
      for (const entry of data.blocked) {
        this.firewall.blockedIps.add(entry.ip);
        this.firewall.blockedIpReasons.set(entry.ip, entry.reason);
        this.firewall.blockedIpAt.set(entry.ip, entry.blockedAt);
      }
    } catch {
      /* start empty on load failure */
    }
    this.membershipHydrated = true;
    this.notify();
    await this.syncFirewallFromOs();
  }

  private persistMembership() {
    if (!this.membershipHydrated) return;
    const trusted: PersistedTrusted[] = [];
    this.trust.trustedIps.forEach((ip) => {
      if (this.trust.builtInTrustedIps.has(ip)) return;
      const domain = this.trust.trustedDomains.get(ip);
      trusted.push(domain ? { ip, domain } : { ip });
    });
    const verified: PersistedTrusted[] = [];
    this.trust.confirmedNormalIps.forEach((ip) => {
      const domain = this.trust.verifiedDomains.get(ip);
      verified.push(domain ? { ip, domain } : { ip });
    });
    const blocked: PersistedBlocked[] = this.firewall.list().map((item) => ({
      ip: item.ip,
      reason: item.reason,
      blockedAt: item.blockedAt,
    }));
    void savePersistedMembership({ version: 1, trusted, verified, blocked });
  }

  /** Merge NetSentinel Windows Firewall rules into UI; re-apply local-only blocks. */
  private async syncFirewallFromOs() {
    const ipc = getElectronIpc();
    if (!ipc) return;
    try {
      const result = (await ipc.invoke('firewall-list-blocked')) as {
        ok?: boolean;
        ips?: Array<{ ip: string; reason?: string }>;
      };
      if (!result?.ok || !Array.isArray(result.ips)) return;

      const osIps = new Set<string>();
      let changed = false;
      for (const item of result.ips) {
        const ip = normalizeIpv4(item.ip);
        if (!ip) continue;
        osIps.add(ip);
        if (!this.firewall.blockedIps.has(ip)) {
          this.firewall.blockedIps.add(ip);
          this.firewall.blockedIpReasons.set(
            ip,
            String(item.reason || 'Windows Firewall (NetSentinel)').slice(0, 120)
          );
          this.firewall.blockedIpAt.set(ip, Date.now());
          changed = true;
        }
      }

      for (const ip of Array.from(this.firewall.blockedIps)) {
        if (osIps.has(ip)) continue;
        const reason = this.firewall.blockedIpReasons.get(ip) || 'Restored NetSentinel block';
        try {
          await ipc.invoke('firewall-block-ip', ip, reason);
        } catch {
          /* best-effort restore */
        }
      }

      this.persistMembership();
      if (changed) this.notify();
    } catch {
      /* ignore list/sync failures (non-admin / IPC) */
    }
  }

  private get blockedIps() {
    return this.firewall.blockedIps;
  }

  private trustDeps(): TrustStoreDeps {
    return {
      sessions: this.sessions,
      blockedIps: this.blockedIps,
      notify: () => this.notify(),
    };
  }

  private firewallDeps(): FirewallDeps {
    return {
      sessions: this.sessions,
      connectionStatus: this.connectionStatus,
      applySessionMembership: (ip) => this.applySessionMembership(ip),
      notify: () => this.notify(),
      setConnectionStatus: (next) => {
        this.connectionStatus = next;
      },
    };
  }

  public setToastNotifier(fn: ((title: string, body: string) => void) | null) {
    this.toast.setNotifier(fn);
  }

  public getConnectionStatus() {
    return { ...this.connectionStatus };
  }

  public applyMonitoringConfig(config: {
    spikeThresholdPacketsPerSec?: number;
    historySpikePacketsPerSec?: number;
    notifyOnNewIp?: boolean;
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
    if (typeof config.activeInterface === 'string') {
      this.monitoringConfig.activeInterface = config.activeInterface;
      const ipc = getElectronIpc();
      if (ipc && config.activeInterface) {
        ipc.invoke('set-capture-adapter', config.activeInterface).catch((err: any) => {
          console.warn('[packet-engine] set-capture-adapter failed:', err);
        });
      } else if (!ipc && config.activeInterface && isElectronShell()) {
        warnIpcUnavailable('Capture adapter');
      }
    }
  }

  public getMyPublicGeo() {
    return this.geo.myPublicGeo;
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
    this.toast.muteFor(8000);
    if (this.ipc()) {
      this.connectionStatus = {
        ...this.connectionStatus,
        mode: 'electron',
      };
      this.notify();
    } else if (isElectronShell()) {
      this.connectionStatus = {
        ...this.connectionStatus,
        mode: 'electron',
        ok: false,
        lastError: 'IPC bridge missing — rebuild with npm run build:exe',
      };
      warnIpcUnavailable('Telemetry');
      this.notify();
    }
    void this.fetchLiveNativePackets();
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

  private ipc() {
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
    let reconcileActive = false;

    // 1) Electron packaged / desktop bridge
    const ipc = this.ipc();
    if (ipc) {
      try {
        const data = await ipc.invoke('get-live-netstat');
        if (data && typeof data === 'object') {
          gotPayload = true;
          reconcileActive = data.ok !== false;
          if (Array.isArray(data.sessions)) rawNativeList = data.sessions;
          if (Array.isArray(data.processes)) this.processes.ingest(data.processes);

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
          reconcileActive = data.ok !== false;
          if (Array.isArray(data.sessions)) rawNativeList = data.sessions;
          else if (Array.isArray(data)) rawNativeList = data;
          if (Array.isArray(data.processes)) this.processes.ingest(data.processes);

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

    this.processRawNativeSessions(rawNativeList, { reconcileActive: gotPayload && reconcileActive });
  }

  private processRawNativeSessions(
    rawNativeList: NativeIpSession[],
    opts: { reconcileActive: boolean }
  ) {
    const timeStr = formatClock(new Date(), true);
    const { secPacketsIn, secPacketsOut, secBytes, secBytesIn, secBytesOut, ipTickStats } =
      ingestNativeSessionList(rawNativeList ?? [], {
        timeStr,
        membershipSets: this.trust.membershipSets(this.blockedIps),
        seenIps: this.seenIps,
        monitoringConfig: this.monitoringConfig,
        anomalies: this.anomalies,
        toast: this.toast,
        geo: this.geo,
        sessionHistory: this.sessionHistory,
        sessions: this.sessions,
        reconcileActive: opts.reconcileActive,
      });

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
    this.trust.trustedIps.forEach((ip) => keep.add(ip));
    this.trust.confirmedNormalIps.forEach((ip) => keep.add(ip));
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
    this.spikes.pushRecentTotal(totalPkts);
    this.spikes.maybeRecord({
      totalPkts,
      historyThreshold: this.monitoringConfig.historySpikePacketsPerSec,
      now: Date.now(),
      timeStr: args.timeStr,
      secPacketsIn: args.secPacketsIn,
      secPacketsOut: args.secPacketsOut,
      secBytes: args.secBytes,
      ipTickStats: args.ipTickStats,
      liveProcesses: this.processes.liveProcesses,
      lastProcessDeltas: this.processes.lastProcessDeltas,
    });
  }

  public resolveAnomaly(id: string) {
    if (this.anomalies.resolve(id)) {
      this.notify();
    }
  }

  public deleteAnomaly(id: string) {
    if (this.anomalies.delete(id)) {
      this.notify();
    }
  }

  public clearResolvedAnomalies() {
    if (this.anomalies.clearResolved()) {
      this.notify();
    }
  }

  /**
   * Wipe monitoring classifications so IPs are re-learned from scratch.
   * Keeps built-in trusted defaults. Attempts firewall unblock for every blocked IP.
   */
  public async resetAllMonitoringState() {
    const blocked = Array.from(this.blockedIps);
    const deps = this.firewallDeps();
    for (const ip of blocked) {
      try {
        await this.firewall.unblockIp(ip, deps);
      } catch {
        // continue — UI state still cleared below
      }
    }

    this.firewall.clearLocal();
    this.seenIps.clear();
    this.anomalies.clearAll();
    this.spikes.clear();
    this.trust.resetToBuiltIns(this.trustDeps());

    this.processes.clearAll();
    this.geo.clearCumulative();
    this.sessionHistory.clear();
    this.trafficHistory = [];
    this.initHistory();

    // Mute new-IP toasts during the first re-learn burst
    this.toast.muteFor(8000);

    this.persistMembership();
    this.notify();
  }

  public removeTrustedIp(ip: string) {
    this.trust.removeTrustedIp(ip, this.trustDeps());
    this.persistMembership();
  }

  public addTrustedIp(ip: string, domain?: string) {
    this.trust.addTrustedIp(ip, domain, this.trustDeps());
    this.persistMembership();
  }

  public addVerifiedNormalIp(ip: string, domain?: string) {
    this.trust.addVerifiedNormalIp(ip, domain, this.trustDeps());
    this.persistMembership();
  }

  public resetNormalStatus(ip: string) {
    this.trust.resetNormalStatus(ip, this.trustDeps());
    this.persistMembership();
  }

  /** Clear user-added Trusted entries; keep built-in defaults. */
  public clearTrustedList() {
    this.trust.clearTrustedList(this.trustDeps());
    this.persistMembership();
  }

  /** Clear all Verified Normal entries (back to NEW unless Trusted/Blocked). */
  public clearVerifiedList() {
    this.trust.clearVerifiedList(this.trustDeps());
    this.persistMembership();
  }

  /** Unblock every blacklisted IP (firewall + UI). */
  public async clearBlacklist() {
    await this.firewall.clearAll(this.firewallDeps());
    this.persistMembership();
  }

  public getSessions(): IpSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.totalPackets - a.totalPackets);
  }

  public getTrafficHistory(maxPoints: number = MAX_TRAFFIC_HISTORY_UI): TrafficHistoryPoint[] {
    if (this.trafficHistory.length <= maxPoints) return this.trafficHistory.slice();
    return this.trafficHistory.slice(-maxPoints);
  }

  public getAnomalyEvents(): AnomalyEvent[] {
    return this.anomalies.events;
  }

  public getSpikeHistory(): SpikeHistoryEntry[] {
    return this.spikes.entries.slice();
  }

  public clearSpikeHistory() {
    if (this.spikes.entries.length === 0) return;
    this.spikes.clearEntriesOnly();
    this.notify();
  }

  public deleteSpikeHistory(id: string) {
    if (this.spikes.delete(id)) this.notify();
  }

  public getBlacklistedIps(): BlacklistedIpItem[] {
    return this.firewall.list();
  }

  public async blockIp(ip: string, reason: string = 'Manual block') {
    const result = await this.firewall.blockIp(ip, reason, this.firewallDeps());
    this.persistMembership();
    return result;
  }

  public async unblockIp(ip: string) {
    const result = await this.firewall.unblockIp(ip, this.firewallDeps());
    this.persistMembership();
    return result;
  }

  public async toggleBlockIp(ip: string) {
    const result = await this.firewall.toggleBlockIp(ip, this.firewallDeps());
    this.persistMembership();
    return result;
  }

  public getProcessBreakdown(): ProcessTrafficPoint[] {
    return this.processes.liveProcesses;
  }

  public getCumulativeProcessBreakdown(): ProcessTrafficPoint[] {
    return Array.from(this.processes.cumulativeProcessMap.values()).sort((a, b) => b.bytesTotal - a.bytesTotal);
  }

  public clearCumulativeProcesses() {
    this.processes.clearCumulative();
    this.notify();
  }

  public getGroupedCumulativeProcesses(): import('../types/network').GroupedProcess[] {
    return sortGroupedProcessesByBytesDesc(
      groupProcessesByName(Array.from(this.processes.cumulativeProcessMap.values()))
    );
  }

  public getCumulativeSessions(): IpSession[] {
    return this.sessionHistory.list();
  }

  public clearCumulativeSessions() {
    this.sessionHistory.clear();
    this.notify();
  }

  public getGeoNodes(): GeoNode[] {
    return this.geo.getLiveGeoNodes(this.sessions.values());
  }

  public getCumulativeGeoNodes(): GeoNode[] {
    return this.geo.getCumulativeGeoNodes();
  }

  public getCumulativeGeoSessions(country: string): IpSession[] {
    return this.geo.getCumulativeGeoSessions(country);
  }

  public clearCumulativeGeoNodes() {
    this.geo.clearCumulative();
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

  /** Sync session row flags from trusted / verified / blocked membership sets. */
  private applySessionMembership(ip: string, hints?: { isTrafficSpike?: boolean }) {
    this.trust.applyToSession(ip, this.trustDeps(), hints);
  }

  public verifyAsNormal(ip: string) {
    this.addVerifiedNormalIp(ip);
  }

  public toggleBaseline(ip: string) {
    this.trust.toggleBaseline(ip, this.trustDeps());
    this.persistMembership();
  }

  public getTrustedList() {
    return this.trust.getTrustedList(this.trustDeps());
  }

  public getConfirmedNormalList() {
    return this.trust.getConfirmedNormalList(this.trustDeps());
  }
}

export const realPacketEngine = new RealPacketEngine();
