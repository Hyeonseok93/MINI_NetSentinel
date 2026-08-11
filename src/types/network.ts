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
  notes?: string;
}

export interface TrafficHistoryPoint {
  time: string;
  packetsIn: number;
  packetsOut: number;
  bytesSec: number;
}

export interface AnomalyEvent {
  id: string;
  timestamp: string;
  ip: string;
  type: 'NEW_IP' | 'TRAFFIC_SPIKE' | 'SUSPICIOUS_PORT' | 'BLACKLISTED_GEO';
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
  lat: number;
  lng: number;
}

export interface QuotaConfig {
  dailyLimitBytes: number; // e.g. 10 * 1024 * 1024 * 1024 (10GB)
  monthlyLimitBytes: number; // e.g. 100 * 1024 * 1024 * 1024 (100GB)
  warningThresholdPercent: number; // e.g. 80
}

export interface MonitoringConfig {
  isMonitoring: boolean;
  spikeThresholdPacketsPerSec: number;
  notifyOnNewIp: boolean;
  autoBlockSuspicious: boolean;
  refreshIntervalMs: number;
  activeInterface: string;
  dailyQuotaValue: number;
  dailyQuotaUnit: 'KB' | 'MB' | 'GB' | 'TB';
}
