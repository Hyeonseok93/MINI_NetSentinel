import { userStoreGet, userStoreSet } from '../userStore';

export type PersistedTrusted = { ip: string; domain?: string };
export type PersistedBlocked = { ip: string; reason: string; blockedAt: number };

export type PersistedMembership = {
  version: 1;
  /** User-added trusted IPs (built-ins are always merged separately). */
  trusted: PersistedTrusted[];
  verified: PersistedTrusted[];
  blocked: PersistedBlocked[];
};

export function emptyMembership(): PersistedMembership {
  return { version: 1, trusted: [], verified: [], blocked: [] };
}

function asMembership(raw: unknown): PersistedMembership {
  if (!raw || typeof raw !== 'object') return emptyMembership();
  const o = raw as Partial<PersistedMembership>;
  return {
    version: 1,
    trusted: Array.isArray(o.trusted) ? (o.trusted as PersistedTrusted[]) : [],
    verified: Array.isArray(o.verified) ? (o.verified as PersistedTrusted[]) : [],
    blocked: Array.isArray(o.blocked) ? (o.blocked as PersistedBlocked[]) : [],
  };
}

function membershipIsEmpty(m: PersistedMembership) {
  return m.trusted.length === 0 && m.verified.length === 0 && m.blocked.length === 0;
}

function readLegacyLocalStorage(): {
  membership: unknown | null;
  monitoringConfig: unknown | null;
} {
  const out = { membership: null as unknown | null, monitoringConfig: null as unknown | null };
  try {
    if (typeof localStorage === 'undefined') return out;
    const membershipRaw = localStorage.getItem('netsentinel-membership-v1');
    const configRaw = localStorage.getItem('netsentinel-monitoring-config-v2');
    if (membershipRaw) {
      try {
        out.membership = JSON.parse(membershipRaw);
      } catch {
        /* ignore */
      }
    }
    if (configRaw) {
      try {
        out.monitoringConfig = JSON.parse(configRaw);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function clearLegacyLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('netsentinel-membership-v1');
    localStorage.removeItem('netsentinel-monitoring-config-v2');
  } catch {
    /* ignore */
  }
}

let migratePromise: Promise<void> | null = null;

/** One-shot: copy legacy renderer localStorage into userData store, then delete old keys. */
export async function ensureUserStoreMigrated(): Promise<void> {
  if (!migratePromise) {
    migratePromise = (async () => {
      const legacy = readLegacyLocalStorage();
      if (!legacy.membership && !legacy.monitoringConfig) return;
      try {
        const existingMembership = asMembership(await userStoreGet('membership'));
        if (membershipIsEmpty(existingMembership) && legacy.membership) {
          await userStoreSet('membership', asMembership(legacy.membership));
        }
        const existingConfig = await userStoreGet('monitoring-config');
        if (!existingConfig && legacy.monitoringConfig) {
          await userStoreSet('monitoring-config', legacy.monitoringConfig);
        }
        clearLegacyLocalStorage();
      } catch {
        /* keep legacy keys if migration write failed */
      }
    })();
  }
  await migratePromise;
}

export async function loadPersistedMembership(): Promise<PersistedMembership> {
  await ensureUserStoreMigrated();
  try {
    return asMembership(await userStoreGet('membership'));
  } catch {
    return emptyMembership();
  }
}

export async function savePersistedMembership(data: PersistedMembership): Promise<void> {
  try {
    await userStoreSet('membership', {
      version: 1,
      trusted: data.trusted,
      verified: data.verified,
      blocked: data.blocked,
    } satisfies PersistedMembership);
  } catch {
    /* ignore write failures */
  }
}
