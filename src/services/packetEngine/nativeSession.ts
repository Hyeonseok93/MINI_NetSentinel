import type { IpSession } from '../../types/network';

/** Real Native Network Session interface returned from Rust/Electron backend */
export interface NativeIpSession {
  id: string;
  ip: string;
  domain?: string;
  country: string;
  country_code?: string;
  countryCode?: string;
  packets_in?: number;
  packetsIn?: number;
  packets_out?: number;
  packetsOut?: number;
  total_packets?: number;
  totalPackets?: number;
  bytes_in?: number;
  bytesIn?: number;
  bytes_out?: number;
  bytesOut?: number;
  total_bytes?: number;
  totalBytes?: number;
  last_seen?: string;
  lastSeen?: string;
  status: string;
  protocol: string;
  port: number;
  is_baseline?: boolean;
  isBaseline?: boolean;
}

export function extractNativeTraffic(native: NativeIpSession) {
  const pIn = native.packets_in ?? native.packetsIn ?? 0;
  const pOut = native.packets_out ?? native.packetsOut ?? 0;
  const tPackets = native.total_packets ?? native.totalPackets ?? pIn + pOut;

  const bIn = native.bytes_in ?? native.bytesIn ?? 0;
  const bOut = native.bytes_out ?? native.bytesOut ?? 0;
  const tBytes = native.total_bytes ?? native.totalBytes ?? bIn + bOut;

  const countryCode = native.country_code ?? native.countryCode ?? 'NET';
  const lastSeen = native.last_seen ?? native.lastSeen ?? '';

  return { pIn, pOut, tPackets, bIn, bOut, tBytes, countryCode, lastSeen };
}

const KNOWN_PROTOCOLS = new Set(['TCP', 'UDP', 'ICMP', 'HTTPS', 'DNS']);

export function normalizeProtocol(protocol: string): IpSession['protocol'] {
  return (KNOWN_PROTOCOLS.has(protocol) ? protocol : 'TCP') as IpSession['protocol'];
}
