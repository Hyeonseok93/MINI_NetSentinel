import type { TrafficHistoryPoint } from '../../types/network';
import { formatClock } from './time';
import { pushCapped, trailingSlice } from './trafficHistoryWindow';

const MAX_HISTORY_POINTS = 86400;

/** Rolling traffic chart history (per-poll samples). */
export class TrafficHistoryStore {
  private points: TrafficHistoryPoint[] = [];

  seedZeros(count = 16) {
    this.points = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 1000);
      this.points.push({
        time: formatClock(t, true),
        packetsIn: 0,
        packetsOut: 0,
        bytesSec: 0,
        bytesIn: 0,
        bytesOut: 0,
      });
    }
  }

  clearAndSeed() {
    this.seedZeros();
  }

  push(point: TrafficHistoryPoint) {
    this.points = pushCapped(this.points, point, MAX_HISTORY_POINTS);
  }

  get(maxPoints: number): TrafficHistoryPoint[] {
    return trailingSlice(this.points, maxPoints);
  }
}
