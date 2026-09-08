import { useEffect, useState } from 'react';
import { realPacketEngine as packetEngine } from '../services/realPacketEngine';
import type {
  AnomalyEvent,
  BlacklistedIpItem,
  GeoNode,
  GroupedProcess,
  IpSession,
  ProcessTrafficPoint,
  SpikeHistoryEntry,
  TrafficHistoryPoint,
  TrustedEntry,
} from '../types/network';
import type { VerifiedNormalEntry } from '../components/TrustedManagerModal';
import { showAppToast } from '../ui/toastBus';

export type EngineSnapshot = {
  sessions: IpSession[];
  history: TrafficHistoryPoint[];
  anomalies: AnomalyEvent[];
  blacklistedIps: BlacklistedIpItem[];
  spikeHistory: SpikeHistoryEntry[];
  connectionStatus: ReturnType<typeof packetEngine.getConnectionStatus>;
  trustedList: TrustedEntry[];
  verifiedNormalList: VerifiedNormalEntry[];
  processBreakdown: ProcessTrafficPoint[];
  cumulativeProcessBreakdown: ProcessTrafficPoint[];
  groupedCumulativeProcesses: GroupedProcess[];
  geoNodes: GeoNode[];
  cumulativeGeoNodes: GeoNode[];
  cumulativeSessions: IpSession[];
  bytesToday: number;
  myPublicGeo: ReturnType<typeof packetEngine.getMyPublicGeo>;
};

function readSnapshot(): EngineSnapshot {
  return {
    sessions: packetEngine.getSessions(),
    history: packetEngine.getTrafficHistory(),
    anomalies: packetEngine.getAnomalyEvents(),
    blacklistedIps: packetEngine.getBlacklistedIps(),
    spikeHistory: packetEngine.getSpikeHistory(),
    connectionStatus: packetEngine.getConnectionStatus(),
    trustedList: packetEngine.getTrustedList(),
    verifiedNormalList: packetEngine.getConfirmedNormalList(),
    processBreakdown: packetEngine.getProcessBreakdown(),
    cumulativeProcessBreakdown: packetEngine.getCumulativeProcessBreakdown(),
    groupedCumulativeProcesses: packetEngine.getGroupedCumulativeProcesses(),
    geoNodes: packetEngine.getGeoNodes(),
    cumulativeGeoNodes: packetEngine.getCumulativeGeoNodes(),
    cumulativeSessions: packetEngine.getCumulativeSessions(),
    bytesToday: packetEngine.getBytesToday(),
    myPublicGeo: packetEngine.getMyPublicGeo(),
  };
}

export function usePacketEngineSnapshot(isMonitoring: boolean, refreshIntervalMs: number) {
  const [snapshot, setSnapshot] = useState<EngineSnapshot>(() => readSnapshot());

  useEffect(() => {
    packetEngine.setToastNotifier((title, body) => showAppToast(title, body, 'info'));
    return () => packetEngine.setToastNotifier(null);
  }, []);

  useEffect(() => {
    // Keep subscription even while paused so Settings mutations (block/trust/reset)
    // still refresh the UI; only polling is gated by isMonitoring.
    const unsubscribe = packetEngine.subscribe(() => {
      setSnapshot(readSnapshot());
    });
    setSnapshot(readSnapshot());

    if (isMonitoring) {
      packetEngine.start(refreshIntervalMs);
    } else {
      packetEngine.stop();
    }

    return () => {
      unsubscribe();
      packetEngine.stop();
    };
  }, [isMonitoring, refreshIntervalMs]);

  return snapshot;
}
