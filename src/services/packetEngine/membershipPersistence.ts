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

function asMembership(raw: unknown): PersistedMembership {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, trusted: [], verified: [], blocked: [] };
  }
  const o = raw as Partial<PersistedMembership>;
  return {
    version: 1,
    trusted: Array.isArray(o.trusted) ? (o.trusted as PersistedTrusted[]) : [],
    verified: Array.isArray(o.verified) ? (o.verified as PersistedTrusted[]) : [],
    blocked: Array.isArray(o.blocked) ? (o.blocked as PersistedBlocked[]) : [],
  };
}

export async function loadPersistedMembership(): Promise<PersistedMembership> {
  try {
    return asMembership(await userStoreGet('membership'));
  } catch {
    return { version: 1, trusted: [], verified: [], blocked: [] };
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
