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
        unpack: '**/{GeoLite2-Country.mmdb,*.node}',
        unpackDir: '{**/data,**/node_modules/koffi}',
      },
      ignore: [
        /^\/src-tauri/,
        /^\/\.git/,
        /^\/release/,
        /^\/dist_portable/,
        /^\/dist_portable_new/,
        /^\/dist_portable_v2/,
        /^\/dist_portable_v3/,
        /^\/dist_electron/,
        /^\/canvases/,
        /^\/scripts\/audit-wiring\.cjs$/,
        /^\/node_modules\/electron($|\/)/,
        /^\/node_modules\/electron-packager($|\/)/,
        /^\/node_modules\/\.cache($|\/)/,
      ],
      win32metadata: {
        CompanyName: 'NetSentinel Enterprise',
        FileDescription: 'NetSentinel Enterprise Packet & Threat Sentinel',
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
