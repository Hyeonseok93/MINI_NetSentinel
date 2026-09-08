import path from 'path';
import { createRequire } from 'module';

const nodeRequire = createRequire(__filename);

type UserStoreApi = {
  root: string;
  read: (key: string) => unknown;
  write: (key: string, value: unknown) => { ok: boolean; key: string };
};

/**
 * JSON files under `{userData}/store/`.
 */
export function createAppUserStore(userDataPath: string): UserStoreApi {
  const { createUserStore } = nodeRequire(
    path.join(__dirname, '..', '..', '..', 'scripts', 'lib', 'user-store.cjs')
  ) as { createUserStore: (dir: string) => UserStoreApi };
  return createUserStore(path.join(userDataPath, 'store'));
}
