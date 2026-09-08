const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const dedupeTs = path.join(root, 'src', 'services', 'packetEngine', 'anomalyDedupe.ts');

describe('AnomalyStore', () => {
  it('suppresses unresolved duplicates but re-fires after resolve', () => {
    const r = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        `
          import { hasOpenAnomalyDuplicate } from ${JSON.stringify(pathToFileURL(dedupeTs).href)};
          const events = [
            { id: 'a1', ip: '1.2.3.4', type: 'TRAFFIC_SPIKE', severity: 'medium', message: 'x', resolved: false, timestamp: 't1' },
          ];
          if (!hasOpenAnomalyDuplicate(events, { ip: '1.2.3.4', type: 'TRAFFIC_SPIKE' })) process.exit(2);
          events[0].resolved = true;
          if (hasOpenAnomalyDuplicate(events, { ip: '1.2.3.4', type: 'TRAFFIC_SPIKE' })) process.exit(3);
          if (hasOpenAnomalyDuplicate(events, { ip: '9.9.9.9', type: 'TRAFFIC_SPIKE' })) process.exit(4);
        `,
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
