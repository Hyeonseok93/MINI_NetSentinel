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
  const m = preloadSrc.match(/allowed\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('Could not parse preload allowlist');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

function extractMainHandlers(mainSrc) {
  return [...mainSrc.matchAll(/ipcMain\.handle\(\s*'([^']+)'/g)].map((x) => x[1]).sort();
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
    const handlers = extractMainHandlers(read('electron-main.cjs'));
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
    assert(app.includes('applyMonitoringConfig'), 'App.tsx missing applyMonitoringConfig');
    assert(settings.includes('list-capture-adapters'), 'Settings missing list-capture-adapters');
    assert(settings.includes('activeInterface'), 'Settings missing activeInterface save path');
    assert(engine.includes('set-capture-adapter'), 'Engine missing set-capture-adapter');
    assert(engine.includes('show-toast'), 'Engine missing show-toast');
    assert(engine.includes('firewall-block-ip'), 'Engine missing firewall-block-ip');
    assert(engine.includes('spikeThresholdPacketsPerSec'), 'Engine missing spike threshold use');
    assert(engine.includes('autoBlockSuspicious'), 'Engine missing autoBlockSuspicious use');
    assert(engine.includes('notifyOnNewIp'), 'Engine missing notifyOnNewIp use');
    assert(!app.includes('Ethernet 0 (Intel(R) Ethernet Connection)'), 'App still has fake hardcoded adapter default');
    console.log('✅ Settings → engine wiring markers present\n');
  } catch (err) {
    failures.push(err.message);
  }

  // 4) GeoIP integrity helpers
  try {
    const dl = read('scripts/download-geoip.cjs');
    const core = read('scripts/telemetry-core.cjs');
    assert(dl.includes('sha256') && dl.includes('SHA256 mismatch'), 'download-geoip missing hash verify');
    assert(core.includes('sha256') && core.includes('SHA256 mismatch'), 'telemetry-core missing hash verify');
    console.log('✅ GeoIP SHA-256 verify present\n');
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
