import { ProcessTrafficPoint, GroupedProcess } from '../types/network';

/**
 * Group per-PID process rows into one entry per processName.
 * Shared by Hub Apps tab + BandwidthGauge / CSV export path.
 */
export function groupProcessesByName(processes: ProcessTrafficPoint[]): GroupedProcess[] {
  const map = new Map<string, GroupedProcess>();

  for (const proc of processes) {
    const existing = map.get(proc.processName);
    if (!existing) {
      map.set(proc.processName, {
        processName: proc.processName,
        pids: [{ ...proc }],
        packetsIn: proc.packetsIn,
        packetsOut: proc.packetsOut,
        totalPackets: proc.totalPackets,
        totalBytes: proc.bytesTotal,
        iconType: proc.iconType,
      });
      continue;
    }

    existing.packetsIn += proc.packetsIn;
    existing.packetsOut += proc.packetsOut;
    existing.totalPackets += proc.totalPackets;
    existing.totalBytes += proc.bytesTotal;
    if (!existing.pids.some((p) => p.pid === proc.pid)) {
      existing.pids.push({ ...proc });
    }
  }

  return Array.from(map.values());
}

export function sortGroupedProcessesByBytesDesc(groups: GroupedProcess[]): GroupedProcess[] {
  return groups.slice().sort((a, b) => b.totalBytes - a.totalBytes);
}
