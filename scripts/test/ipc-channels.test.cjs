const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');

describe('IPC channel sync', () => {
  it('shared JSON matches preload allowlist and channels.ts', () => {
    const channels = JSON.parse(
      fs.readFileSync(path.join(root, 'shared', 'ipc-channels.json'), 'utf8')
    );
    assert.ok(Array.isArray(channels) && channels.length > 0);
    assert.ok(channels.includes('firewall-list-blocked'));
    assert.ok(channels.includes('user-store-get'));
    assert.ok(channels.includes('user-store-set'));
    assert.ok(!channels.includes('auto-block')); // no such channel

    const preload = fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8');
    const channelsTs = fs.readFileSync(path.join(root, 'src', 'ipc', 'channels.ts'), 'utf8');
    for (const ch of channels) {
      assert.ok(preload.includes(`"${ch}"`), `preload missing ${ch}`);
      assert.ok(channelsTs.includes(`"${ch}"`), `channels.ts missing ${ch}`);
    }
  });

  it('sync-ipc-channels exits 0', () => {
    const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'sync-ipc-channels.cjs')], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
