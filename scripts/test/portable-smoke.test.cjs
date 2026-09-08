const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const exe = path.join(root, 'release', 'NetSentinel', 'NetSentinel.exe');
const asarPath = path.join(root, 'release', 'NetSentinel', 'resources', 'app.asar');
const hasPortable = process.platform === 'win32' && fs.existsSync(exe) && fs.existsSync(asarPath);

describe('portable package smoke', { skip: !hasPortable }, () => {
  it('ships exe and required runtime files inside asar', () => {
    const asar = require('@electron/asar');
    const names = asar.listPackage(asarPath).map((p) => String(p).replace(/\\/g, '/'));

    assert.ok(fs.statSync(exe).size > 1_000_000, 'exe too small');
    assert.ok(names.some((p) => p.endsWith('/dist/index.html') || p === '/dist/index.html'));
    assert.ok(names.some((p) => p.includes('scripts/lib/user-store.cjs')));
    assert.ok(names.some((p) => p.includes('electron/dist/main.js') || p.includes('electron/dist/lib/')));
    assert.ok(names.some((p) => p.includes('shared/ipc-channels.json')));

    // App source must not ship; node_modules may contain vendor */src/*.tsx
    assert.ok(
      !names.some(
        (p) =>
          !p.includes('/node_modules/') &&
          (p === '/src' || p.startsWith('/src/')) &&
          /\.(tsx?|jsx?)$/.test(p)
      )
    );
  });
});
