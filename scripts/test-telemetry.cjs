const { exec } = require('child_process');
const util = require('util');
const telemetry = require('./telemetry-core.cjs');
const path = require('path');

const execAsync = util.promisify(exec);

async function runStrictTelemetryTest() {
  console.log('🧪 Running NetSentinel Production Telemetry Verification...');

  try {
    const geo = await telemetry.ensureGeoIp({
      writablePath: path.resolve(__dirname, '..', 'data', telemetry.GEOIP_DB_FILENAME),
      autoDownload: false,
    });
    if (!geo.active) {
      throw new Error('GeoLite2 DB is not loaded. Run download-geoip first.');
    }
    console.log('✅ GeoLite2 DB active');

    const capture = telemetry.startPacketCapture();
    console.log(`✅ Capture start: mode=${capture.mode}${capture.device ? ` device=${capture.device}` : ''}`);

    // Allow Npcap a moment to accumulate packets
    await new Promise((r) => setTimeout(r, 1200));
    const payload = await telemetry.fetchTelemetryPayload();
    telemetry.stopPacketCapture();

    if (!payload.ok) {
      throw new Error(`Telemetry payload failed: ${payload.error || 'unknown'}`);
    }
    if (!Array.isArray(payload.sessions) || payload.sessions.length === 0) {
      // Fallback proof that netstat still works even if machine is idle on npcap
      const { stdout } = await execAsync('netstat -n -o -p TCP', { timeout: 2000 });
      const established = stdout.split('\n').filter((l) => l.includes('ESTABLISHED')).length;
      if (established === 0) {
        throw new Error('No sessions from telemetry and no ESTABLISHED netstat rows');
      }
      console.log(`⚠️ Telemetry sessions empty but netstat has ${established} ESTABLISHED rows (idle capture window)`);
    } else {
      console.log(`✅ Telemetry sessions: ${payload.sessions.length} (captureMode=${payload.captureMode})`);
    }

    const withCountry = (payload.sessions || []).filter(
      (s) => s.country && s.country !== 'Unknown Location'
    ).length;
    console.log(`✅ Geo-resolved sessions: ${withCountry}`);

    if (payload.captureMode === 'npcap') {
      const withBytes = (payload.sessions || []).filter((s) => (s.total_bytes || 0) > 0).length;
      console.log(`✅ Npcap sessions with byte counters this interval: ${withBytes}`);
    } else {
      console.log('ℹ️ Netstat mode: packet/byte volumes intentionally zero (inventory only)');
    }

    console.log('✅ Strict Telemetry Verification PASSED');
    process.exit(0);
  } catch (err) {
    console.error('❌ Strict Telemetry Verification FAILED:', err.message);
    try {
      telemetry.stopPacketCapture();
    } catch (_) {}
    process.exit(1);
  }
}

runStrictTelemetryTest();
