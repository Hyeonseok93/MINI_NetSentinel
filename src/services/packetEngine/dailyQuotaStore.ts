import { localDayKey } from './dailyQuota';
import { loadPersistedQuotaDaily, savePersistedQuotaDaily } from './quotaDailyPersistence';

/** Calendar-day byte accumulator with debounced persistence. */
export class DailyQuotaStore {
  private hydrated = false;
  private bytesToday = 0;
  private dayKey = '';
  private persistTimer: number | null = null;

  async bootstrap(onReady?: () => void) {
    try {
      const data = await loadPersistedQuotaDaily();
      const today = localDayKey();
      if (data.day === today) {
        this.dayKey = today;
        this.bytesToday = data.bytes;
      } else {
        this.dayKey = today;
        this.bytesToday = 0;
        if (data.day) void savePersistedQuotaDaily({ version: 1, day: today, bytes: 0 });
      }
    } catch {
      this.dayKey = localDayKey();
      this.bytesToday = 0;
    }
    this.hydrated = true;
    onReady?.();
  }

  private rollDay() {
    const today = localDayKey();
    if (this.dayKey === today) return;
    this.dayKey = today;
    this.bytesToday = 0;
  }

  addBytes(delta: number) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.rollDay();
    this.bytesToday += delta;
    this.schedulePersist();
  }

  getBytesToday(): number {
    this.rollDay();
    return this.bytesToday;
  }

  /** Reset to empty for today and persist immediately. */
  resetToday() {
    this.dayKey = localDayKey();
    this.bytesToday = 0;
    void savePersistedQuotaDaily({ version: 1, day: this.dayKey, bytes: 0 });
  }

  private schedulePersist() {
    if (!this.hydrated) return;
    if (this.persistTimer !== null) return;
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null;
      void savePersistedQuotaDaily({
        version: 1,
        day: this.dayKey || localDayKey(),
        bytes: this.bytesToday,
      });
    }, 1500);
  }
}
