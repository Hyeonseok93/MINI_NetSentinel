import type { SpikeHistoryEntry } from '../../types/network';

export function shouldRecordSpike(args: {
  totalPkts: number;
  recentTotals: number[];
  historyThreshold: number;
  lastRecordAt: number;
  lastEntryTotal: number | null;
  now?: number;
}): boolean {
  const { totalPkts, recentTotals, historyThreshold, lastRecordAt, lastEntryTotal } = args;
  const now = args.now ?? Date.now();

  const avg =
    recentTotals.reduce((s, n) => s + n, 0) / Math.max(1, recentTotals.length);
  // User-configurable absolute floor (Settings → History Spike Threshold)
  const absFloor = Math.max(20, historyThreshold);
  // Also catch sudden surges vs recent average (at least 2× avg, and at least absFloor)
  const relativeFloor = Math.max(absFloor, avg * 2.5);
  const isSpike = totalPkts >= relativeFloor;

  if (!isSpike) return false;

  // Cooldown unless this second is clearly higher than the previous recorded spike
  const cooler = now - lastRecordAt < 4000;
  if (cooler && lastEntryTotal != null && totalPkts < lastEntryTotal * 1.15) {
    return false;
  }

  return true;
}

export function buildSpikeEntry(args: {
  now: number;
  timeStr: string;
  secPacketsIn: number;
  secPacketsOut: number;
  secBytes: number;
  totalPkts: number;
  ipTickStats: SpikeHistoryEntry['topIps'];
  liveProcesses: Array<{
    processName: string;
    totalPackets: number;
    bytesTotal: number;
    iconType: SpikeHistoryEntry['topProcesses'][number]['iconType'];
  }>;
  lastProcessDeltas: SpikeHistoryEntry['topProcesses'];
}): SpikeHistoryEntry {
  const topIps = [...args.ipTickStats]
    .sort((a, b) => b.packets - a.packets || b.bytes - a.bytes)
    .slice(0, 8);

  // Telemetry process rows are already per-interval; prefer live snapshot over cumulative deltas
  const fromLive = args.liveProcesses
    .slice()
    .sort((a, b) => b.totalPackets - a.totalPackets || b.bytesTotal - a.bytesTotal)
    .slice(0, 8)
    .map((p) => ({
      processName: p.processName,
      packets: p.totalPackets,
      bytes: p.bytesTotal,
      iconType: p.iconType,
    }));
  const topProcesses = fromLive.length > 0 ? fromLive : args.lastProcessDeltas.slice(0, 8);
  const topProcName = topProcesses[0]?.processName;
  const topIp = topIps[0]?.ip;

  const reasonParts: string[] = [];
  if (topProcName) reasonParts.push(`top app ${topProcName}`);
  if (topIp) reasonParts.push(`top IP ${topIp}`);
  if (reasonParts.length === 0) reasonParts.push('aggregate traffic surge');

  return {
    id: `spike-${args.now}`,
    timestamp: args.timeStr,
    atMs: args.now,
    packetsIn: args.secPacketsIn,
    packetsOut: args.secPacketsOut,
    bytesSec: args.secBytes,
    reason: `Spike ${args.totalPkts} pkts/s — ${reasonParts.join(', ')}`,
    topIps,
    topProcesses,
  };
}
