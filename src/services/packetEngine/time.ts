/** 24h HH:mm:ss — avoids locale "오전/오후" line-wrapping in charts/tables */
export function formatClock(date: Date = new Date(), withSeconds = true): string {
  return date.toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
  });
}
