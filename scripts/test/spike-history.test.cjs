const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const spikeTs = path.join(root, 'src', 'services', 'packetEngine', 'spikeHistory.ts');

describe('shouldRecordSpike', () => {
  it('requires absolute floor and respects cooldown unless surge is clearly higher', () => {
    const r = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
          import { shouldRecordSpike } from ${JSON.stringify(pathToFileURL(spikeTs).href)};
          const base = {
            recentTotals: [10, 12, 11],
            historyThreshold: 50,
            lastRecordAt: 0,
            lastEntryTotal: null,
            now: 10_000,
          };
          if (shouldRecordSpike({ ...base, totalPkts: 40 })) process.exit(2);
          if (!shouldRecordSpike({ ...base, totalPkts: 50 })) process.exit(3);
          if (
            shouldRecordSpike({
              ...base,
              totalPkts: 55,
              lastRecordAt: 9_000,
              lastEntryTotal: 50,
              now: 10_000,
            })
          ) {
            process.exit(4);
          }
          if (
            !shouldRecordSpike({
              ...base,
              totalPkts: 60,
              lastRecordAt: 9_000,
              lastEntryTotal: 50,
              now: 10_000,
            })
          ) {
            process.exit(5);
          }
        `,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
