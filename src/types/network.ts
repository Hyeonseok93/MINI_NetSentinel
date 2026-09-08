export interface IpSession {
  id: string;
  ip: string;
  domain?: string;
  country: string;
  countryCode: string;
  packetsIn: number;
  packetsOut: number;
  totalPackets: number;
  bytesIn: number;
  bytesOut: number;
  totalBytes: number;
  lastSeen: string;
  status: 'normal' | 'new' | 'suspicious' | 'blocked';
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTPS' | 'DNS';
  port: number;
  isBaseline: boolean;
}

export interface TrafficHistoryPoint {
  time: string;
  packetsIn: number;
  packetsOut: number;
  bytesSec: number;
  bytesIn?: number;
  bytesOut?: number;
}

export interface AnomalyEvent {
  id: string;
  timestamp: string;
  ip: string;
  type: 'NEW_IP' | 'TRAFFIC_SPIKE';
  severity: 'low' | 'medium' | 'high';
  message: string;
  resolved: boolean;
}

export interface TrustedEntry {
  ip: string;
  domain?: string;
  addedAt: string;
  note?: string;
}

export interface ProcessTrafficPoint {
  processName: string;
  pid: number;
  packetsIn: number;
  packetsOut: number;
  totalPackets: number;
  bytesTotal: number;
  iconType: 'browser' | 'chat' | 'system' | 'game' | 'code' | 'cloud' | 'default';
}

export interface GeoNode {
  country: string;
  countryCode: string;
  activeIpCount: number;
  totalBytes: number;
}

export interface MonitoringConfig {
  spikeThresholdPacketsPerSec: number;
  /** Aggregate chart pkts/s that records a History snapshot */
  historySpikePacketsPerSec: number;
  notifyOnNewIp: boolean;
  refreshIntervalMs: number;
  activeInterface: string;
  dailyQuotaValue: number;
  dailyQuotaUnit: 'KB' | 'MB' | 'GB' | 'TB';
}

export interface BlacklistedIpItem {
  ip: string;
  reason: string;
  blockedAt: number;
}

/** Snapshot captured around a traffic spike for History tab forensics. */
export interface SpikeHistoryEntry {
  id: string;
  timestamp: string;
  atMs: number;
  packetsIn: number;
  packetsOut: number;
  bytesSec: number;
  reason: string;
  topIps: Array<{
    ip: string;
    domain?: string;
    country: string;
    packets: number;
    bytes: number;
    processHint?: string;
  }>;
  topProcesses: Array<{
    processName: string;
    packets: number;
    bytes: number;
    iconType: ProcessTrafficPoint['iconType'];
  }>;
}

export interface GroupedProcess {
  processName: string;
  pids: ProcessTrafficPoint[];
  packetsIn: number;
  packetsOut: number;
  totalPackets: number;
  totalBytes: number;
  iconType: 'browser' | 'chat' | 'system' | 'game' | 'code' | 'cloud' | 'default';
}
