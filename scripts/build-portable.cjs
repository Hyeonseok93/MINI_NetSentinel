const packager = require('electron-packager');
const path = require('path');
const fs = require('fs');

const APP_NAME = 'NetSentinel';
const ROOT = path.resolve(__dirname, '..');

function rmrf(target) {
  if (!target || !fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function moveDir(src, dest) {
  rmrf(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
  } catch {
    // Cross-device / locked rename fallback
    fs.cpSync(src, dest, { recursive: true });
    rmrf(src);
  }
}

/** Paths relative to app root, always with leading `/` and forward slashes. */
function normalizePackPath(filePath) {
  return `/${String(filePath).replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

function shouldIgnore(filePath) {
  const p = normalizePackPath(filePath);

  // Source maps / TypeScript sources (runtime uses electron/dist + Vite dist)
  if (p.endsWith('.map')) return true;
  if (/\.(ts|tsx|mts|cts)$/.test(p) && !p.includes('/node_modules/')) return true;

  const exactDirs = [
    '/.git',
    '/.vscode',
    '/.cursor',
    '/release',
    '/dist_portable',
    '/dist_portable_new',
    '/dist_portable_v2',
    '/dist_portable_v3',
    '/dist_electron',
    '/canvases',
    '/src',
    '/node_modules/electron',
    '/node_modules/electron-packager',
    '/node_modules/.cache',
  ];
  for (const dir of exactDirs) {
    if (p === dir || p.startsWith(`${dir}/`)) return true;
  }

  if (p === '/.cursorignore' || p === '/.gitignore') return true;
  if (p === '/README.md' || p === '/LICENSE' || p === '/LICENSE.md') return true;
  if (/^\/tsconfig(\..+)?\.json$/.test(p)) return true;
  if (p === '/vite.config.ts' || p === '/vite.config.js') return true;
  if (p === '/index.html') return true; // Vite root; packaged UI is dist/index.html
  if (p === '/package-lock.json') return true;

  if (p === '/data/my-public-ip.json' || /^\/data\/.+\.sha256$/.test(p)) return true;

  // Dev / build-only scripts (runtime needs telemetry / firewall / npcap / geoip-core)
  if (
    /^\/scripts\/(audit-wiring|sync-ipc-channels|test-telemetry|build-portable|clean-old-builds|download-geoip)\.cjs$/.test(
      p
    )
  ) {
    return true;
  }
  if (p === '/scripts/test' || p.startsWith('/scripts/test/')) return true;
  if (p === '/.github' || p.startsWith('/.github/')) return true;

  return false;
}

async function buildExe() {
  const iconPath = path.join(ROOT, 'public', 'icon.ico');
  const iconPathNoExt = path.join(ROOT, 'public', 'icon');
  const stagingDir = path.join(ROOT, 'release', '_staging');
  const finalDir = path.join(ROOT, 'release', APP_NAME);

  console.log(`Building ${APP_NAME} portable → release/${APP_NAME}/`);

  if (!fs.existsSync(iconPath)) {
    console.error('icon.ico does not exist at:', iconPath);
    process.exit(1);
  }

  const requiredArtifacts = [
    path.join(ROOT, 'electron', 'dist', 'main.js'),
    path.join(ROOT, 'electron', 'preload.cjs'),
    path.join(ROOT, 'electron', 'ipc-allowlist.cjs'),
    path.join(ROOT, 'dist', 'index.html'),
  ];
  for (const p of requiredArtifacts) {
    if (!fs.existsSync(p)) {
      console.error('Missing build artifact (run npm run build:exe / build:electron first):', p);
      process.exit(1);
    }
  }

  // Wipe entire release/ so locked alt folders cannot linger
  rmrf(path.join(ROOT, 'release'));
  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    const appPaths = await packager({
      dir: ROOT,
      name: APP_NAME,
      platform: 'win32',
      arch: 'x64',
      icon: iconPathNoExt,
      out: stagingDir,
      overwrite: true,
      prune: true,
      asar: {
        unpack: '**/{GeoLite2-Country.mmdb,*.node,electron/preload.cjs,electron/dialog-preload.cjs}',
        unpackDir: '{**/data,**/node_modules/koffi}',
      },
      ignore: shouldIgnore,
      win32metadata: {
        CompanyName: 'NetSentinel',
        FileDescription: 'NetSentinel network monitor',
        OriginalFilename: `${APP_NAME}.exe`,
        ProductName: APP_NAME,
        InternalName: APP_NAME,
      },
    });

    const packed = appPaths && appPaths[0];
    if (!packed || !fs.existsSync(packed)) {
      throw new Error('Packager finished but output folder was missing');
    }

    const exePath = path.join(packed, `${APP_NAME}.exe`);
    if (!fs.existsSync(exePath)) {
      throw new Error(`Expected ${APP_NAME}.exe missing in ${packed}`);
    }

    try {
      moveDir(packed, finalDir);
    } catch (err) {
      console.error(
        `Could not replace release/${APP_NAME}/ (is NetSentinel.exe still running?). Close it and rebuild.`
      );
      throw err;
    }
    rmrf(stagingDir);

    // Drop Vite intermediate (already baked into the packaged asar)
    rmrf(path.join(ROOT, 'dist'));

    console.log(`✅ Ready: ${finalDir}`);
    console.log(`   Launch: ${path.join(finalDir, `${APP_NAME}.exe`)}`);
    console.log(
      '   Note: Electron needs the whole NetSentinel folder (runtime DLLs + resources). The .exe alone will not run.'
    );
  } catch (err) {
    console.error('Error during Production Packager build:', err);
    rmrf(stagingDir);
    process.exit(1);
  }
}

buildExe();
