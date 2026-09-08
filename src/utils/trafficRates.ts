import type { TrafficHistoryPoint } from '../types/network';

/** Prefer explicit bytesIn/Out; missing sides are 0 (no invented Rx/Tx split). */
export function ratesFromHistoryPoint(point?: Partial<TrafficHistoryPoint> | null): {
  rxBytesPerSec: number;
  txBytesPerSec: number;
} {
  if (!point) return { rxBytesPerSec: 0, txBytesPerSec: 0 };
  return {
    rxBytesPerSec: point.bytesIn ?? 0,
    txBytesPerSec: point.bytesOut ?? 0,
  };
}

export function latestTrafficRates(history: TrafficHistoryPoint[]): {
  rxBytesPerSec: number;
  txBytesPerSec: number;
} {
  return ratesFromHistoryPoint(history.length > 0 ? history[history.length - 1] : null);
}
