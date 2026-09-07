/**
 * Build-time GeoIP fetch — delegates to telemetry-core (SHA-verified mirrors only).
 */
const path = require('path');
const fs = require('fs');
const telemetry = require('./telemetry-core.cjs');

async function downloadGeoIpForBundle() {
  const dataDir = path.resolve(__dirname, '..', 'data');
  const targetPath = path.join(dataDir, telemetry.GEOIP_DB_FILENAME);

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 100_000) {
    console.log('✅ Bundled GeoIP DB already present:', targetPath);
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  console.log('⬇️  Downloading GeoLite2-Country.mmdb for portable bundle...');
  await telemetry.downloadGeoIpDatabase(targetPath);
  const size = fs.statSync(targetPath).size;
  console.log(`✅ GeoIP DB saved (${size} bytes):`, targetPath);
}

downloadGeoIpForBundle().catch((err) => {
  console.error('❌ GeoIP bundle download failed:', err.message);
  process.exit(1);
});
