import type { SpikeHistoryEntry } from '../../types/network';
import { buildSpikeEntry, shouldRecordSpike } from './spikeHistory';

/** Owns spike history list + recording cooldown state. */
export class SpikeHistoryStore {
  entries: SpikeHistoryEntry[] = [];
  recentTotalPackets: number[] = [];
  lastSpikeRecordAt = 0;

  clear() {
    this.entries = [];
    this.recentTotalPackets = [];
    this.lastSpikeRecordAt = 0;
  }

  clearEntriesOnly() {
    this.entries = [];
  }

  delete(id: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    return this.entries.length !== before;
  }

  pushRecentTotal(totalPkts: number, maxWindow = 12) {
    this.recentTotalPackets.push(totalPkts);
    if (this.recentTotalPackets.length > maxWindow) this.recentTotalPackets.shift();
  }

  maybeRecord(args: {
    totalPkts: number;
    historyThreshold: number;
    now: number;
    timeStr: string;
    secPacketsIn: number;
    secPacketsOut: number;
    secBytes: number;
    ipTickStats: SpikeHistoryEntry['topIps'];
    liveProcesses: Array<{
      processName: string;
      totalPackets: number;
      bytesTotal: number;
      iconType: SpikeHistoryEntry['topProcesses'][number]['iconType'];
    }>;
    lastProcessDeltas: SpikeHistoryEntry['topProcesses'];
  }): boolean {
    const lastEntryTotal = this.entries[0]?.packetsIn != null
      ? this.entries[0].packetsIn + this.entries[0].packetsOut
      : null;

    const should = shouldRecordSpike({
      totalPkts: args.totalPkts,
      recentTotals: this.recentTotalPackets,
      historyThreshold: args.historyThreshold,
      lastRecordAt: this.lastSpikeRecordAt,
      lastEntryTotal,
      now: args.now,
    });
    if (!should) return false;

    const entry = buildSpikeEntry({
      now: args.now,
      timeStr: args.timeStr,
      secPacketsIn: args.secPacketsIn,
      secPacketsOut: args.secPacketsOut,
      secBytes: args.secBytes,
      totalPkts: args.totalPkts,
      ipTickStats: args.ipTickStats,
      liveProcesses: args.liveProcesses,
      lastProcessDeltas: args.lastProcessDeltas,
    });
    this.entries.unshift(entry);
    if (this.entries.length > 200) this.entries.length = 200;
    this.lastSpikeRecordAt = args.now;
    return true;
  }
}
