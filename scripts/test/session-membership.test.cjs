const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const membershipTs = path.join(root, 'src', 'services', 'packetEngine', 'sessionMembership.ts');

function loadMembershipModule() {
  const r = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `
        import { resolveSessionMembership } from ${JSON.stringify(pathToFileURL(membershipTs).href)};
        const sets = {
          trustedIps: new Set(['8.8.8.8']),
          confirmedNormalIps: new Set(['1.1.1.1']),
          blockedIps: new Set(['9.9.9.9']),
        };
        const cases = [
          ['9.9.9.9', {}, { status: 'blocked', isBaseline: false }],
          ['8.8.8.8', {}, { status: 'normal', isBaseline: true }],
          ['1.1.1.1', {}, { status: 'normal', isBaseline: false }],
          ['2.2.2.2', { isTrafficSpike: true }, { status: 'spike', isBaseline: false }],
          ['2.2.2.2', {}, { status: 'new', isBaseline: false }],
        ];
        for (const [ip, hints, expected] of cases) {
          const got = resolveSessionMembership(ip, sets, hints);
          if (got.status !== expected.status || got.isBaseline !== expected.isBaseline) {
            console.error(JSON.stringify({ ip, hints, got, expected }));
            process.exit(1);
          }
        }
      `,
    ],
    { cwd: root, encoding: 'utf8' }
  );
  return r;
}

describe('sessionMembership', () => {
  it('resolves blocked / trusted / spike / new without threat heuristic', () => {
    const r = loadMembershipModule();
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
