/** Local calendar day key YYYY-MM-DD for daily quota rollover. */
export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type QuotaDailyState = {
  version: 1;
  day: string;
  bytes: number;
};

export function emptyQuotaDaily(): QuotaDailyState {
  return { version: 1, day: '', bytes: 0 };
}

export function normalizeQuotaDaily(raw: unknown): QuotaDailyState {
  if (!raw || typeof raw !== 'object') return emptyQuotaDaily();
  const o = raw as Partial<QuotaDailyState>;
  const day = typeof o.day === 'string' ? o.day.slice(0, 32) : '';
  const bytes = Number(o.bytes);
  return {
    version: 1,
    day,
    bytes: Number.isFinite(bytes) && bytes > 0 ? bytes : 0,
  };
}
