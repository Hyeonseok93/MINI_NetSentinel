const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'dist',
  'dist_portable',
  'dist_portable_new',
  'dist_portable_v2',
  'dist_portable_v3',
  'dist_electron',
  'release/_staging',
];

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

let failed = 0;
for (const rel of TARGETS) {
  const target = path.join(ROOT, rel);
  if (!fs.existsSync(target)) continue;
  try {
    rmrf(target);
    console.log('removed', rel);
  } catch (err) {
    failed += 1;
    console.warn(`locked (close Cursor preview / NetSentinel using it): ${rel}`);
    console.warn(' ', err.message);
  }
}

if (failed) {
  console.warn(`\n${failed} path(s) still locked. Close anything browsing those folders, then re-run: npm run clean:build`);
  process.exitCode = 1;
} else {
  console.log('✅ Old build artifacts cleaned');
}
