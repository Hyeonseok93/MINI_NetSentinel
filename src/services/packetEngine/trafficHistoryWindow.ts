/** Trailing window for chart history (mirrors TrafficHistoryStore.get). */
export function trailingSlice<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points.slice();
  return points.slice(-maxPoints);
}

/** Push then drop from the front when over cap (mirrors TrafficHistoryStore.push). */
export function pushCapped<T>(points: T[], point: T, maxPoints: number): T[] {
  const next = points.concat(point);
  if (next.length <= maxPoints) return next;
  return next.slice(next.length - maxPoints);
}
