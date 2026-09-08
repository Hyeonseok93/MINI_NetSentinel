const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const quotaTs = path.join(root, 'src', 'services', 'packetEngine', 'dailyQuota.ts');

describe('dailyQuota', () => {
  it('formats local day keys and normalizes persisted quota JSON', () => {
    const r = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
          import { localDayKey, normalizeQuotaDaily, emptyQuotaDaily } from ${JSON.stringify(
            pathToFileURL(quotaTs).href
          )};
          const d = new Date(2026, 8, 8, 15, 0, 0);
          if (localDayKey(d) !== '2026-09-08') process.exit(2);
          const empty = emptyQuotaDaily();
          if (empty.version !== 1 || empty.day !== '' || empty.bytes !== 0) process.exit(3);
          const a = normalizeQuotaDaily({ version: 1, day: '2026-09-08', bytes: 1234 });
          if (a.day !== '2026-09-08' || a.bytes !== 1234) process.exit(4);
          const b = normalizeQuotaDaily({ day: 99, bytes: -5 });
          if (b.day !== '' || b.bytes !== 0) process.exit(5);
          const c = normalizeQuotaDaily(null);
          if (c.bytes !== 0) process.exit(6);
        `,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
