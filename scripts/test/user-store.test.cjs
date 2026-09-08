const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createUserStore,
  sanitizeTrustedList,
  sanitizeBlockedList,
  ALLOWED_KEYS,
} = require('../lib/user-store.cjs');

describe('user-store sanitizers', () => {
  it('drops invalid IPs and keeps domains/reasons', () => {
    const trusted = sanitizeTrustedList([
      { ip: '1.2.3.4', domain: 'a.example' },
      { ip: 'bad' },
      { ip: '1.2.3.4', domain: 'dup' },
    ]);
    assert.deepEqual(trusted, [{ ip: '1.2.3.4', domain: 'a.example' }]);

    const blocked = sanitizeBlockedList([
      { ip: ' 9.9.9.9 ', reason: 'manual', blockedAt: 42 },
      { ip: 'nope' },
    ]);
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0].ip, '9.9.9.9');
    assert.equal(blocked[0].blockedAt, 42);
  });
});

describe('user-store files', () => {
  it('round-trips allowlisted JSON atomically', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-store-'));
    const store = createUserStore(dir);
    assert.ok(ALLOWED_KEYS.includes('membership'));

    store.write('membership', {
      trusted: [{ ip: '1.2.3.4' }],
      verified: [],
      blocked: [{ ip: '9.9.9.9', reason: 'x', blockedAt: 7 }],
    });
    const loaded = store.read('membership');
    assert.equal(loaded.trusted[0].ip, '1.2.3.4');
    assert.equal(loaded.blocked[0].ip, '9.9.9.9');
    assert.ok(fs.existsSync(path.join(dir, 'membership.json')));

    store.write('monitoring-config', { spikeThresholdPacketsPerSec: 55, autoBlockSuspicious: true });
    const cfg = store.read('monitoring-config');
    assert.equal(cfg.spikeThresholdPacketsPerSec, 55);
    assert.equal(cfg.autoBlockSuspicious, undefined);

    assert.throws(() => store.write('nope', {}), /Unknown user-store key/);
  });
});
