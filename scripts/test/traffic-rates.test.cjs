const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const trafficTs = path.join(root, 'src', 'utils', 'trafficRates.ts');

describe('trafficRates', () => {
  it('prefers bytesIn/Out and does not invent a 70/30 split', () => {
    const r = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
          import { ratesFromHistoryPoint, latestTrafficRates } from ${JSON.stringify(
            pathToFileURL(trafficTs).href
          )};
          const a = ratesFromHistoryPoint({ bytesIn: 100, bytesOut: 20, bytesSec: 999 });
          if (a.rxBytesPerSec !== 100 || a.txBytesPerSec !== 20) process.exit(2);
          const b = ratesFromHistoryPoint({ bytesSec: 100 });
          if (b.rxBytesPerSec !== 0 || b.txBytesPerSec !== 0) process.exit(3);
          const c = latestTrafficRates([]);
          if (c.rxBytesPerSec !== 0) process.exit(4);
          const d = latestTrafficRates([{ time: 'x', packetsIn: 0, packetsOut: 0, bytesSec: 0, bytesIn: 5, bytesOut: 1 }]);
          if (d.rxBytesPerSec !== 5 || d.txBytesPerSec !== 1) process.exit(5);
        `,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
