import type { IpSession } from '../../types/network';

/** Session row shape from telemetry (Electron IPC / Vite /api/live-netstat). */
export interface NativeIpSession {
  id: string;
  ip: string;
  domain?: string;
  country: string;
  countryCode?: string;
  packetsIn?: number;
  packetsOut?: number;
  totalPackets?: number;
  bytesIn?: number;
  bytesOut?: number;
  totalBytes?: number;
  lastSeen?: string;
  status: string;
  protocol: string;
  port: number;
  isBaseline?: boolean;
}

export function extractNativeTraffic(native: NativeIpSession) {
  const pIn = native.packetsIn ?? 0;
  const pOut = native.packetsOut ?? 0;
  const tPackets = native.totalPackets ?? pIn + pOut;

  const bIn = native.bytesIn ?? 0;
  const bOut = native.bytesOut ?? 0;
  const tBytes = native.totalBytes ?? bIn + bOut;

  const countryCode = native.countryCode ?? 'NET';
  const lastSeen = native.lastSeen ?? '';

  return { pIn, pOut, tPackets, bIn, bOut, tBytes, countryCode, lastSeen };
}

const KNOWN_PROTOCOLS = new Set(['TCP', 'UDP', 'TCP+UDP']);

export function normalizeProtocol(protocol: string): IpSession['protocol'] {
  const p = String(protocol || '').toUpperCase();
  if (KNOWN_PROTOCOLS.has(p)) return p as IpSession['protocol'];
  return 'TCP';
}
