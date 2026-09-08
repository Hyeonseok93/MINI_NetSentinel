import type { AnomalyEvent } from '../../types/network';
import { MAX_ANOMALY_EVENTS } from './constants';
import { hasOpenAnomalyDuplicate } from './anomalyDedupe';

export class AnomalyStore {
  events: AnomalyEvent[] = [];

  trigger(event: AnomalyEvent) {
    if (!hasOpenAnomalyDuplicate(this.events, event)) {
      this.events.unshift(event);
      if (this.events.length > MAX_ANOMALY_EVENTS) {
        this.events.length = MAX_ANOMALY_EVENTS;
      }
    }
  }

  resolve(id: string): boolean {
    const anom = this.events.find((a) => a.id === id);
    if (!anom) return false;
    anom.resolved = true;
    return true;
  }

  delete(id: string): boolean {
    const before = this.events.length;
    this.events = this.events.filter((a) => a.id !== id);
    return this.events.length !== before;
  }

  clearResolved(): boolean {
    const before = this.events.length;
    this.events = this.events.filter((a) => !a.resolved);
    return this.events.length !== before;
  }

  clearAll() {
    this.events = [];
  }
}
