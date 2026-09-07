import { realPacketEngine as packetEngine } from '../services/realPacketEngine';
import type { IpSession } from '../types/network';

/** Stable action API for UI — keeps components off the engine singleton. */
export function createPacketEngineActions() {
  return {
    toggleBaseline: (ip: string) => packetEngine.toggleBaseline(ip),
    verifyAsNormal: (ip: string) => packetEngine.verifyAsNormal(ip),
    toggleBlockIp: (ip: string) => packetEngine.toggleBlockIp(ip),
    clearCumulativeProcesses: () => packetEngine.clearCumulativeProcesses(),
    clearCumulativeGeoNodes: () => packetEngine.clearCumulativeGeoNodes(),
    getCumulativeGeoSessions: (country: string): IpSession[] =>
      packetEngine.getCumulativeGeoSessions(country),
    resolveAnomaly: (id: string) => packetEngine.resolveAnomaly(id),
    deleteAnomaly: (id: string) => packetEngine.deleteAnomaly(id),
    clearResolvedAnomalies: () => packetEngine.clearResolvedAnomalies(),
    clearSpikeHistory: () => packetEngine.clearSpikeHistory(),
    deleteSpikeHistory: (id: string) => packetEngine.deleteSpikeHistory(id),
    resetAllMonitoringState: () => packetEngine.resetAllMonitoringState(),
    removeTrustedIp: (ip: string) => packetEngine.removeTrustedIp(ip),
    addTrustedIp: (ip: string, domain?: string) => packetEngine.addTrustedIp(ip, domain),
    addVerifiedNormalIp: (ip: string, domain?: string) =>
      packetEngine.addVerifiedNormalIp(ip, domain),
    resetNormalStatus: (ip: string) => packetEngine.resetNormalStatus(ip),
    clearTrustedList: () => packetEngine.clearTrustedList(),
    clearVerifiedList: () => packetEngine.clearVerifiedList(),
    unblockIp: (ip: string) => packetEngine.unblockIp(ip),
    blockIp: (ip: string, reason?: string) => packetEngine.blockIp(ip, reason),
    clearBlacklist: () => packetEngine.clearBlacklist(),
  };
}

export type PacketEngineActions = ReturnType<typeof createPacketEngineActions>;
