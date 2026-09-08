import {
  IpSession,
  AnomalyEvent,
  TrafficHistoryPoint,
  ProcessTrafficPoint,
  GeoNode,
  GroupedProcess,
  BlacklistedIpItem,
  SpikeHistoryEntry,
} from '../types/network';
import { getElectronIpc, isElectronShell, warnIpcUnavailable } from '../utils/electronIpc';
import { groupProcessesByName, sortGroupedProcessesByBytesDesc } from '../utils/groupProcesses';
import {
  MAX_TRAFFIC_HISTORY_UI,
  MAX_SEEN_IPS,
  MIN_HISTORY_SPIKE_PACKETS_PER_SEC,
} from './packetEngine/limits';
import { type NativeIpSession } from './packetEngine/nativeSession';
import { formatClock } from './packetEngine/time';
import { ingestNativeSessionList } from './packetEngine/sessionIngest';
import { ToastGate } from './packetEngine/toastGate';
import { AnomalyStore } from './packetEngine/anomalyStore';
import { GeoStore } from './packetEngine/geoStore';
import { FirewallStore, type FirewallDeps } from './packetEngine/firewallStore';
import { ProcessAccumulator } from './packetEngine/processAccumulator';
import { SessionHistoryStore } from './packetEngine/sessionHistoryStore';
import { DailyQuotaStore } from './packetEngine/dailyQuotaStore';
import { TrafficHistoryStore } from './packetEngine/trafficHistoryStore';
import {
  fetchLiveTelemetry,
  type ConnectionStatus,
} from './packetEngine/fetchLiveTelemetry';
import {
  bootstrapMembership,
  persistMembership,
  type MembershipLifecycleDeps,
} from './packetEngine/membershipLifecycle';
import { TrustStore, type TrustStoreDeps } from './packetEngine/trustStore';
import { SpikeHistoryStore } from './packetEngine/spikeHistoryStore';

/** Thin orchestrator — domain logic lives in packetEngine/* stores. */
export class RealPacketEngine {
  private sessions: Map<string, IpSession> = new Map();
  private history = new TrafficHistoryStore();
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
  private quota = new DailyQuotaStore();
  private fetchInFlight = false;
  private listeners: (() => void)[] = [];
  private membershipHydrated = false;
  private connectionStatus: ConnectionStatus = {
    mode: 'offline',
    ok: false,
    lastError: null,
    lastSuccessAt: null,
    captureMode: 'unknown',
  };

  constructor() {
    this.history.seedZeros();
    void bootstrapMembership(this.membershipDeps());
    void this.quota.bootstrap(() => this.notify());
    void this.geo.detectMyPublicGeo(() => this.notify());
  }

  private membershipDeps(): MembershipLifecycleDeps {
    return {
      trust: this.trust,
      firewall: this.firewall,
      notify: () => this.notify(),
      setHydrated: (v) => {
        this.membershipHydrated = v;
      },
      isHydrated: () => this.membershipHydrated,
    };
  }

  private persistMembership() {
    persistMembership(this.membershipDeps());
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
      this.monitoringConfig.historySpikePacketsPerSec = Math.max(
        MIN_HISTORY_SPIKE_PACKETS_PER_SEC,
        config.historySpikePacketsPerSec
      );
    }
    if (typeof config.notifyOnNewIp === 'boolean') {
      this.monitoringConfig.notifyOnNewIp = config.notifyOnNewIp;
    }
    if (typeof config.activeInterface === 'string') {
      this.monitoringConfig.activeInterface = config.activeInterface;
      const ipc = getElectronIpc();
      if (ipc && config.activeInterface) {
        ipc.invoke('set-capture-adapter', config.activeInterface).catch((err: unknown) => {
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

  public start(intervalMs: number = 1000) {
    if (this.intervalId !== null) return;
    this.toast.muteFor(8000);
    if (getElectronIpc()) {
      this.connectionStatus = { ...this.connectionStatus, mode: 'electron' };
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

  private async fetchLiveNativePackets() {
    if (this.fetchInFlight) return;
    this.fetchInFlight = true;
    try {
      const result = await fetchLiveTelemetry(this.connectionStatus);
      this.connectionStatus = result.connectionStatus;
      if (result.processes) this.processes.ingest(result.processes);
      this.processRawNativeSessions(result.sessions, {
        reconcileActive: result.reconcileActive,
      });
    } finally {
      this.fetchInFlight = false;
    }
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

    this.history.push({
      time: timeStr,
      packetsIn: secPacketsIn,
      packetsOut: secPacketsOut,
      bytesSec: secBytes,
      bytesIn: secBytesIn,
      bytesOut: secBytesOut,
    });

    if (opts.reconcileActive) {
      this.quota.addBytes(secBytes);
    }

    const totalPkts = secPacketsIn + secPacketsOut;
    this.spikes.pushRecentTotal(totalPkts);
    this.spikes.maybeRecord({
      totalPkts,
      historyThreshold: this.monitoringConfig.historySpikePacketsPerSec,
      now: Date.now(),
      timeStr,
      secPacketsIn,
      secPacketsOut,
      secBytes,
      ipTickStats,
      liveProcesses: this.processes.liveProcesses,
      lastProcessDeltas: this.processes.lastProcessDeltas,
    });

    this.geo.refreshCumulativeHighs(this.sessions.values());
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

  public resolveAnomaly(id: string) {
    if (this.anomalies.resolve(id)) this.notify();
  }

  public deleteAnomaly(id: string) {
    if (this.anomalies.delete(id)) this.notify();
  }

  public clearResolvedAnomalies() {
    if (this.anomalies.clearResolved()) this.notify();
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
        /* continue */
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
    this.history.clearAndSeed();
    this.quota.resetToday();
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

  public clearTrustedList() {
    this.trust.clearTrustedList(this.trustDeps());
    this.persistMembership();
  }

  public clearVerifiedList() {
    this.trust.clearVerifiedList(this.trustDeps());
    this.persistMembership();
  }

  public async clearBlacklist() {
    await this.firewall.clearAll(this.firewallDeps());
    this.persistMembership();
  }

  public getSessions(): IpSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.totalPackets - a.totalPackets);
  }

  public getBytesToday(): number {
    return this.quota.getBytesToday();
  }

  public getTrafficHistory(maxPoints: number = MAX_TRAFFIC_HISTORY_UI): TrafficHistoryPoint[] {
    return this.history.get(maxPoints);
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
    return Array.from(this.processes.cumulativeProcessMap.values()).sort(
      (a, b) => b.bytesTotal - a.bytesTotal
    );
  }

  public getGroupedCumulativeProcesses(): GroupedProcess[] {
    return sortGroupedProcessesByBytesDesc(
      groupProcessesByName(Array.from(this.processes.cumulativeProcessMap.values()))
    );
  }

  public getCumulativeSessions(): IpSession[] {
    return this.sessionHistory.list();
  }

  public clearAllCumulativeHistory() {
    this.sessionHistory.clear();
    this.processes.clearCumulative();
    this.geo.clearCumulative();
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

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

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
