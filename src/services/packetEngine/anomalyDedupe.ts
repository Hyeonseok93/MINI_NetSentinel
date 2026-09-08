import type { AnomalyEvent } from '../../types/network';

/** True when an unresolved event already covers this ip+type. */
export function hasOpenAnomalyDuplicate(
  events: AnomalyEvent[],
  event: Pick<AnomalyEvent, 'ip' | 'type'>
): boolean {
  return events.some((e) => e.ip === event.ip && e.type === event.type && !e.resolved);
}
