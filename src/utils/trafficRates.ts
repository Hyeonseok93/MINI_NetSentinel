import type { TrafficHistoryPoint } from '../types/network';

/** Prefer explicit bytesIn/Out; fall back to legacy bytesSec split. */
export function ratesFromHistoryPoint(point?: Partial<TrafficHistoryPoint> | null): {
  rxBytesPerSec: number;
  txBytesPerSec: number;
} {
  if (!point) return { rxBytesPerSec: 0, txBytesPerSec: 0 };
  const bytesSec = point.bytesSec || 0;
  return {
    rxBytesPerSec: point.bytesIn ?? Math.floor(bytesSec * 0.7),
    txBytesPerSec: point.bytesOut ?? Math.floor(bytesSec * 0.3),
  };
}

export function latestTrafficRates(history: TrafficHistoryPoint[]): {
  rxBytesPerSec: number;
  txBytesPerSec: number;
} {
  return ratesFromHistoryPoint(history.length > 0 ? history[history.length - 1] : null);
}
