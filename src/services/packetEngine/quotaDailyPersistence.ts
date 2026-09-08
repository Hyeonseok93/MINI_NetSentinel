import { userStoreGet, userStoreSet } from '../userStore';
import { emptyQuotaDaily, normalizeQuotaDaily, type QuotaDailyState } from './dailyQuota';

export async function loadPersistedQuotaDaily(): Promise<QuotaDailyState> {
  try {
    return normalizeQuotaDaily(await userStoreGet('quota-daily'));
  } catch {
    return emptyQuotaDaily();
  }
}

export async function savePersistedQuotaDaily(data: QuotaDailyState): Promise<void> {
  try {
    await userStoreSet('quota-daily', normalizeQuotaDaily(data));
  } catch {
    /* ignore write failures */
  }
}
