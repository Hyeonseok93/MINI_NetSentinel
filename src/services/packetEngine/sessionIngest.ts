import type { AnomalyEvent, IpSession, SpikeHistoryEntry } from '../../types/network';
import { extractNativeTraffic, normalizeProtocol, type NativeIpSession } from './nativeSession';
import { resolveSessionMembership, type MembershipSets } from './sessionMembership';
import { reconcileActiveSessions } from './sessionReconcile';
import type { AnomalyStore } from './anomalyStore';
import type { GeoStore } from './geoStore';
import type { ToastGate } from './toastGate';
import type { SessionHistoryStore } from './sessionHistoryStore';

export type IngestMonitoringConfig = {
  spikeThresholdPacketsPerSec: number;
  notifyOnNewIp: boolean;
};

export type IngestTickContext = {
  timeStr: string;
  membershipSets: MembershipSets;
  seenIps: Set<string>;
  monitoringConfig: IngestMonitoringConfig;
  anomalies: AnomalyStore;
  toast: ToastGate;
  geo: GeoStore;
  sessionHistory: SessionHistoryStore;
  sessions: Map<string, IpSession>;
  /** When true, drop map entries not present in this tick (successful poll only). */
  reconcileActive: boolean;
};

export type IngestTickResult = {
  secPacketsIn: number;
  secPacketsOut: number;
  secBytes: number;
  secBytesIn: number;
  secBytesOut: number;
  ipTickStats: SpikeHistoryEntry['topIps'];
};

export { reconcileActiveSessions } from './sessionReconcile';

/** Apply one native session into maps + anomaly/toast side effects. */
export function ingestNativeSession(native: NativeIpSession, ctx: IngestTickContext): {
  pIn: number;
  pOut: number;
  bIn: number;
  bOut: number;
  tBytes: number;
  tickStat: SpikeHistoryEntry['topIps'][number] | null;
} {
  const extracted = extractNativeTraffic(native);
  const { pIn, pOut, tPackets, bIn, bOut, tBytes, countryCode } = extracted;
  const lastSeen = extracted.lastSeen || ctx.timeStr;

  const tickStat =
    pIn + pOut > 0 || tBytes > 0
      ? {
          ip: native.ip,
          domain: native.domain,
          country: native.country || '—',
          packets: pIn + pOut,
          bytes: tBytes,
        }
      : null;

  const sets = ctx.membershipSets;
  const isBaseline = sets.trustedIps.has(native.ip);
  const isConfirmedNormal = sets.confirmedNormalIps.has(native.ip);
  const isBlocked = sets.blockedIps.has(native.ip);
  const isFirstSeen = !ctx.seenIps.has(native.ip);
  ctx.seenIps.add(native.ip);

  const packetsThisSec = pIn + pOut;
  const isTrafficSpike = packetsThisSec >= ctx.monitoringConfig.spikeThresholdPacketsPerSec;
  const { status: resolvedStatus, isBaseline: membershipBaseline } = resolveSessionMembership(
    native.ip,
    sets,
    { isTrafficSpike }
  );

  if (!isBlocked && !isBaseline && !isConfirmedNormal && isTrafficSpike) {
    ctx.anomalies.trigger({
      id: `anom-spike-${native.ip}-${Date.now()}`,
      ip: native.ip,
      timestamp: ctx.timeStr,
      type: 'TRAFFIC_SPIKE',
      severity: 'medium',
      message: `Packet-rate spike on ${native.ip}: ${packetsThisSec} pkts/s (threshold ${ctx.monitoringConfig.spikeThresholdPacketsPerSec})`,
      resolved: false,
    } satisfies AnomalyEvent);
  }

  // Toast + NEW_IP event share the notifyOnNewIp setting (inventory, not a threat signal).
  if (isFirstSeen && !isBaseline && !isConfirmedNormal && !isBlocked && ctx.monitoringConfig.notifyOnNewIp) {
    ctx.toast.notify(
      true,
      'New remote IP',
      `${native.ip} (${native.country || 'Unknown'}) port ${native.port}`
    );
    ctx.anomalies.trigger({
      id: `anom-new-${native.ip}-${Date.now()}`,
      ip: native.ip,
      timestamp: ctx.timeStr,
      type: 'NEW_IP',
      severity: 'low',
      message: `First seen this run: ${native.ip} (${native.country})`,
      resolved: false,
    } satisfies AnomalyEvent);
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
    isBaseline: membershipBaseline,
  };

  ctx.sessions.set(native.ip, currentSession);
  const deltas = { pIn, pOut, tPackets, bIn, bOut, tBytes };
  ctx.geo.upsertCountrySession(currentSession, deltas);
  ctx.sessionHistory.upsert(currentSession, deltas);

  return { pIn, pOut, bIn, bOut, tBytes, tickStat };
}

/** Process a full native session list for one poll tick. */
export function ingestNativeSessionList(
  rawNativeList: NativeIpSession[],
  ctx: IngestTickContext
): IngestTickResult {
  let secPacketsIn = 0;
  let secPacketsOut = 0;
  let secBytes = 0;
  let secBytesIn = 0;
  let secBytesOut = 0;
  const ipTickStats: SpikeHistoryEntry['topIps'] = [];
  const liveIps = new Set<string>();

  for (const native of rawNativeList) {
    if (native?.ip) liveIps.add(native.ip);
    const { pIn, pOut, bIn, bOut, tBytes, tickStat } = ingestNativeSession(native, ctx);
    if (tickStat) ipTickStats.push(tickStat);
    secPacketsIn += pIn;
    secPacketsOut += pOut;
    secBytesIn += bIn;
    secBytesOut += bOut;
    secBytes += tBytes;
  }

  if (ctx.reconcileActive) {
    reconcileActiveSessions(ctx.sessions, liveIps);
  }

  return { secPacketsIn, secPacketsOut, secBytes, secBytesIn, secBytesOut, ipTickStats };
}
