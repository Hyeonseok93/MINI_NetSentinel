import { getElectronIpc, isElectronShell } from '../utils/electronIpc';

export type UserStoreKey = 'monitoring-config' | 'membership';

/**
 * Renderer client for Electron userData JSON store.
 * Vite-dev mirrors the same keys via `/api/user-store/:key` → data/dev-user-store/.
 */
export async function userStoreGet(key: UserStoreKey): Promise<unknown | null> {
  const ipc = getElectronIpc();
  if (ipc) {
    const result = await ipc.invoke('user-store-get', key);
    if (result?.ok === false) {
      throw new Error(result.error || `user-store-get failed: ${key}`);
    }
    return result?.value ?? null;
  }

  if (isElectronShell()) {
    throw new Error('user-store IPC unavailable');
  }

  const res = await fetch(`/api/user-store/${key}`);
  if (!res.ok) {
    throw new Error(`user-store GET ${key}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; value?: unknown; error?: string };
  if (body.ok === false) {
    throw new Error(body.error || `user-store GET failed: ${key}`);
  }
  return body.value ?? null;
}

export async function userStoreSet(key: UserStoreKey, value: unknown): Promise<void> {
  const ipc = getElectronIpc();
  if (ipc) {
    const result = await ipc.invoke('user-store-set', key, value);
    if (result?.ok === false) {
      throw new Error(result.error || `user-store-set failed: ${key}`);
    }
    return;
  }

  if (isElectronShell()) {
    throw new Error('user-store IPC unavailable');
  }

  const res = await fetch(`/api/user-store/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    throw new Error(`user-store PUT ${key}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (body.ok === false) {
    throw new Error(body.error || `user-store PUT failed: ${key}`);
  }
}
