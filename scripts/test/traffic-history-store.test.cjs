const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const windowTs = path.join(root, 'src', 'services', 'packetEngine', 'trafficHistoryWindow.ts');

describe('TrafficHistoryStore', () => {
  it('caps retained points and returns a trailing slice', () => {
    const r = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
          import { pushCapped, trailingSlice } from ${JSON.stringify(pathToFileURL(windowTs).href)};
          let pts = [1, 2, 3, 4];
          if (trailingSlice(pts, 10).length !== 4) process.exit(2);
          if (trailingSlice(pts, 2).join(',') !== '3,4') process.exit(3);
          pts = pushCapped(pts, 5, 4);
          if (pts.join(',') !== '2,3,4,5') process.exit(4);
          pts = pushCapped(pts, 6, 4);
          if (pts.join(',') !== '3,4,5,6') process.exit(5);
        `,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
