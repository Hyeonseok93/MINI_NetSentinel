/**
 * Offline wiring audit: IPC allowlist ↔ main handlers ↔ renderer invokes,
 * plus telemetry/npcap smoke. Exit 1 on any hard failure.
 */
const fs = require('fs');
const path = require('path');
const telemetry = require('./telemetry-core.cjs');
const firewall = require('./firewall-windows.cjs');
const npcap = require('./npcap-capture.cjs');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function extractAllowedChannels(preloadSrc) {
  // Prefer shared JSON (single source of truth)
  const sharedPath = path.join(root, 'shared', 'ipc-channels.json');
  if (fs.existsSync(sharedPath)) {
    const list = JSON.parse(fs.readFileSync(sharedPath, 'utf8'));
    if (Array.isArray(list) && list.length) return [...list].sort();
  }
  const m = preloadSrc.match(/allowed\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('Could not parse preload allowlist');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

function extractMainHandlers(...sources) {
  const channels = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)) {
      channels.add(m[1]);
    }
  }
  return [...channels].sort();
}

function readElectronSources() {
  const chunks = [];
  const pushIfExists = (rel) => {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) chunks.push(fs.readFileSync(p, 'utf8'));
  };
  pushIfExists('electron/main.ts');
  pushIfExists('electron/dist/main.js');

  for (const dirRel of ['electron/lib', 'electron/dist/lib']) {
    const libDir = path.join(root, dirRel);
    if (!fs.existsSync(libDir)) continue;
    for (const name of fs.readdirSync(libDir)) {
      if (!/\.(cjs|js|ts)$/.test(name)) continue;
      chunks.push(fs.readFileSync(path.join(libDir, name), 'utf8'));
    }
  }
  return chunks;
}

function extractRendererInvokes(srcRoot) {
  const channels = new Set();
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'dist') continue;
        walk(p);
      } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
        const text = fs.readFileSync(p, 'utf8');
        for (const m of text.matchAll(/\.invoke\(\s*['"]([^'"]+)['"]/g)) {
          channels.add(m[1]);
        }
      }
    }
  };
  walk(srcRoot);
  return [...channels].sort();
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const failures = [];
  const notes = [];

  console.log('=== NetSentinel wiring audit ===\n');

  // 1) IPC matrix
  try {
    const allowed = extractAllowedChannels(read('electron/preload.cjs'));
    const handlers = extractMainHandlers(read('electron-main.cjs'), ...readElectronSources());
    const invokes = extractRendererInvokes(path.join(root, 'src'));

    console.log('Preload allowlist:', allowed.join(', '));
    console.log('Main handlers:   ', handlers.join(', '));
    console.log('Renderer invokes:', invokes.join(', ') || '(none)');

    for (const ch of allowed) {
      if (!handlers.includes(ch)) failures.push(`Allowlisted but no main handler: ${ch}`);
    }
    for (const ch of handlers) {
      if (!allowed.includes(ch)) failures.push(`Main handler not allowlisted: ${ch}`);
    }
    for (const ch of invokes) {
      if (!allowed.includes(ch)) failures.push(`Renderer invoke not allowlisted: ${ch}`);
    }
    if (!failures.length) console.log('✅ IPC matrix consistent\n');
  } catch (err) {
    failures.push(`IPC matrix parse: ${err.message}`);
  }

  // 2) Core exports present
  try {
    for (const fn of [
      'fetchTelemetryPayload',
      'ensureGeoIp',
      'updateGeoIp',
      'listCaptureDevices',
      'setCaptureDevice',
      'startPacketCapture',
      'stopPacketCapture',
      'getCaptureStatus',
      'resolveMyPublicGeo',
    ]) {
      assert(typeof telemetry[fn] === 'function', `telemetry-core missing export: ${fn}`);
    }
    for (const fn of ['firewallBlockIp', 'firewallUnblockIp']) {
      assert(typeof firewall[fn] === 'function', `firewall missing export: ${fn}`);
    }
    for (const fn of ['listCaptureDevices', 'setPreferredDevice', 'startCapture', 'takeIntervalStats']) {
      assert(typeof npcap[fn] === 'function', `npcap-capture missing export: ${fn}`);
    }
    console.log('✅ Core module exports OK\n');
  } catch (err) {
    failures.push(err.message);
  }

  // 3) Settings / engine wiring presence in source
  try {
    const app = read('src/App.tsx');
    const settings = read('src/components/SettingsModal.tsx');
    const engine = read('src/services/realPacketEngine.ts');
    const engineTree = [
      engine,
      ...fs
        .readdirSync(path.join(root, 'src', 'services', 'packetEngine'))
        .filter((n) => /\.(ts|tsx|js|cjs)$/.test(n))
        .map((n) => read(path.join('src', 'services', 'packetEngine', n))),
    ].join('\n');
    assert(app.includes('useMonitoringConfig') || app.includes('applyMonitoringConfig'), 'App.tsx missing monitoring config wiring');
    assert(settings.includes('list-capture-adapters'), 'Settings missing list-capture-adapters');
    assert(settings.includes('activeInterface'), 'Settings missing activeInterface save path');
    assert(engineTree.includes('set-capture-adapter'), 'Engine missing set-capture-adapter');
    assert(
      engineTree.includes('ToastGate') ||
        engineTree.includes('toastGate') ||
        engineTree.includes('setToastNotifier') ||
        engineTree.includes('setNotifier'),
      'Engine missing in-app toast path'
    );
    assert(engineTree.includes('firewall-block-ip'), 'Engine missing firewall-block-ip');
    assert(engine.includes('spikeThresholdPacketsPerSec'), 'Engine missing spike threshold use');
    assert(engine.includes('autoBlockSuspicious'), 'Engine missing autoBlockSuspicious use');
    assert(engine.includes('notifyOnNewIp'), 'Engine missing notifyOnNewIp use');
    assert(!app.includes('Ethernet 0 (Intel(R) Ethernet Connection)'), 'App still has fake hardcoded adapter default');
    assert(app.includes('ConfirmHost') && app.includes('ToastHost'), 'App missing ConfirmHost/ToastHost');
    assert(!settings.includes('window.confirm'), 'Settings still uses window.confirm');
    console.log('✅ Settings → engine wiring markers present\n');
  } catch (err) {
    failures.push(err.message);
  }

  // 4) GeoIP integrity helpers
  try {
    const dl = read('scripts/download-geoip.cjs');
    const geoCore = fs.existsSync(path.join(root, 'scripts', 'lib', 'geoip-core.cjs'))
      ? read('scripts/lib/geoip-core.cjs')
      : read('scripts/telemetry-core.cjs');
    assert(dl.includes('downloadGeoIpDatabase'), 'download-geoip should delegate to telemetry-core');
    assert(geoCore.includes('sha256') && geoCore.includes('SHA256 mismatch'), 'geoip missing hash verify');
    console.log('✅ GeoIP SHA-256 verify present\n');
  } catch (err) {
    failures.push(err.message);
  }

  // 4b) Shared single-source checks
  try {
    const sharedChannels = JSON.parse(read('shared/ipc-channels.json'));
    const preload = read('electron/preload.cjs');
    assert(Array.isArray(sharedChannels) && sharedChannels.length > 0, 'shared/ipc-channels.json empty');
    assert(preload.includes('contextBridge.exposeInMainWorld'), 'preload must expose electronIPC');
    assert(preload.includes('Object.freeze(['), 'preload must inline IPC channel allowlist');
    assert(!preload.includes("require('./ipc-allowlist"), 'preload must not sibling-require ipc-allowlist under sandbox/asar');
    assert(fs.existsSync(path.join(root, 'electron', 'ipc-allowlist.cjs')), 'electron/ipc-allowlist.cjs missing — run sync-ipc-channels');
    for (const ch of sharedChannels) {
      assert(preload.includes(`"${ch}"`) || preload.includes(`'${ch}'`), `preload missing channel ${ch}`);
    }
    const channelsTs = read('src/ipc/channels.ts');
    assert(channelsTs.includes('as const'), 'channels.ts must use as const for literal IpcChannel');
    assert(channelsTs.includes('AUTO-GENERATED'), 'channels.ts should be generated by sync-ipc-channels');
    for (const ch of sharedChannels) {
      assert(channelsTs.includes(`"${ch}"`) || channelsTs.includes(`'${ch}'`), `channels.ts missing ${ch}`);
    }
    const famous = JSON.parse(read('shared/famous-ips.json'));
    assert(Array.isArray(famous.defaultTrustedIps), 'famous-ips missing defaultTrustedIps');
    const ipv4Cjs = read('shared/ipv4.cjs');
    assert(ipv4Cjs.includes('isValidIpv4'), 'shared ipv4 incomplete');
    assert(ipv4Cjs.includes('/^\\d{1,3}(\\.\\d{1,3}){3}$/'), 'shared/ipv4.cjs missing octet regex');
    assert(read('src/utils/ip.ts').includes('shared/ipv4.cjs'), 'src/utils/ip.ts must import shared/ipv4.cjs');
    console.log('✅ Shared IPC / famous-ips / ipv4 sources present\n');
  } catch (err) {
    failures.push(err.message);
  }

  // 5) No code-signing leftover
  try {
    const build = read('scripts/build-portable.cjs');
    assert(!build.includes('WINDOWS_PFX'), 'build-portable still has code-signing hook');
    assert(!build.includes('signtool'), 'build-portable still references signtool');
    console.log('✅ Code signing removed from build\n');
  } catch (err) {
    failures.push(err.message);
  }

  // 6) Live telemetry / npcap smoke
  try {
    const geo = await telemetry.ensureGeoIp({
      writablePath: path.join(root, 'data', telemetry.GEOIP_DB_FILENAME),
      autoDownload: false,
    });
    assert(geo.active, 'GeoLite2 DB not loaded');
    const capture = telemetry.startPacketCapture();
    await new Promise((r) => setTimeout(r, 1000));
    const payload = await telemetry.fetchTelemetryPayload();
    const status = telemetry.getCaptureStatus();
    telemetry.stopPacketCapture();

    assert(payload.ok, `telemetry payload not ok: ${payload.error || 'unknown'}`);
    assert(Array.isArray(payload.sessions), 'sessions not an array');
    console.log(
      `✅ Live smoke: mode=${payload.captureMode} sessions=${payload.sessions.length} device=${status.device || status.deviceName || 'n/a'}`
    );
    if (payload.captureMode === 'npcap') {
      const withBytes = payload.sessions.filter((s) => (s.total_bytes || 0) > 0).length;
      console.log(`   Npcap byte-counter sessions this interval: ${withBytes}`);
      if (withBytes === 0) notes.push('Npcap up but no byte deltas in 1s window (idle OK)');
    } else {
      notes.push('Running in netstat fallback (Npcap unavailable or open failed)');
    }

    const adapters = telemetry.listCaptureDevices();
    console.log(`✅ Adapter list: ${adapters.length} device(s)`);
    if (adapters[0]) {
      const set = telemetry.setCaptureDevice(adapters[0].name);
      assert(set && (set.ok === true || set.mode), `setCaptureDevice failed: ${JSON.stringify(set)}`);
      console.log(`✅ setCaptureDevice OK → ${adapters[0].description || adapters[0].name}`);
      telemetry.stopPacketCapture();
    }
    console.log('');
  } catch (err) {
    try {
      telemetry.stopPacketCapture();
    } catch (_) {}
    failures.push(`Live smoke: ${err.message}`);
  }

  // 7) Firewall module sanity (no elevate required — just validation path)
  try {
    const bad = await firewall.firewallBlockIp('not-an-ip');
    assert(bad && bad.ok === false, 'firewall should reject invalid IP');
    console.log('✅ Firewall IPv4 validation rejects garbage\n');
  } catch (err) {
    // assertIpv4 throws — also fine
    if (!/Invalid IPv4/.test(err.message)) failures.push(`Firewall validation: ${err.message}`);
    else console.log('✅ Firewall IPv4 validation throws on garbage\n');
  }

  if (notes.length) {
    console.log('Notes:');
    for (const n of notes) console.log(' -', n);
    console.log('');
  }

  if (failures.length) {
    console.error('❌ AUDIT FAILED');
    for (const f of failures) console.error(' -', f);
    process.exit(1);
  }

  console.log('✅ AUDIT PASSED — wiring and live capture look solid');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ AUDIT CRASHED:', err);
  process.exit(1);
});
