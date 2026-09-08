const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const ingestTs = path.join(root, 'src', 'services', 'packetEngine', 'sessionReconcile.ts');

function runReconcileCheck() {
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        import { reconcileActiveSessions } from ${JSON.stringify(pathToFileURL(ingestTs).href)};
        const sessions = new Map([
          ['1.1.1.1', { ip: '1.1.1.1' }],
          ['8.8.8.8', { ip: '8.8.8.8' }],
          ['9.9.9.9', { ip: '9.9.9.9' }],
        ]);
        reconcileActiveSessions(sessions, new Set(['1.1.1.1', '8.8.8.8']));
        if (sessions.size !== 2 || sessions.has('9.9.9.9') || !sessions.has('1.1.1.1')) {
          console.error(JSON.stringify([...sessions.keys()]));
          process.exit(1);
        }
      `,
    ],
    { cwd: root, encoding: 'utf8' }
  );
}

describe('reconcileActiveSessions', () => {
  it('drops IPs missing from the live tick set', () => {
    const r = runReconcileCheck();
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
