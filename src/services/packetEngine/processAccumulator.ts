import type { ProcessTrafficPoint, SpikeHistoryEntry } from '../../types/network';

/** Live + cumulative process traffic accumulator. */
export class ProcessAccumulator {
  liveProcesses: ProcessTrafficPoint[] = [];
  cumulativeProcessMap = new Map<string, ProcessTrafficPoint>();
  prevProcessStatsMap = new Map<string, { bytesTotal: number; packetsIn: number; packetsOut: number }>();
  lastProcessDeltas: SpikeHistoryEntry['topProcesses'] = [];

  ingest(processes: ProcessTrafficPoint[]) {
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

  clearCumulative() {
    this.cumulativeProcessMap.clear();
  }

  clearAll() {
    this.liveProcesses = [];
    this.cumulativeProcessMap.clear();
    this.prevProcessStatsMap.clear();
    this.lastProcessDeltas = [];
  }
}
