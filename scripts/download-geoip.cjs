const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GEOIP_DB_FILENAME = 'GeoLite2-Country.mmdb';
const GEOIP_DOWNLOAD_URLS = [
  {
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-Country.mmdb',
    sha256Url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-Country.mmdb.sha256sum',
  },
  {
    url: 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-Country.mmdb',
    sha256Url: null,
  },
];

function parseSha256Sum(text) {
  const line = String(text || '').trim().split(/\r?\n/)[0] || '';
  const match = line.match(/^([a-fA-F0-9]{64})\s+/);
  return match ? match[1].toLowerCase() : null;
}

async function downloadGeoIpForBundle() {
  const dataDir = path.resolve(__dirname, '..', 'data');
  const targetPath = path.join(dataDir, GEOIP_DB_FILENAME);

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 100_000) {
    console.log('✅ Bundled GeoIP DB already present:', targetPath);
    return;
  }

  fs.mkdirSync(dataDir, { recursive: true });
  console.log('⬇️  Downloading GeoLite2-Country.mmdb for portable bundle...');

  let lastError = null;
  for (const mirror of GEOIP_DOWNLOAD_URLS) {
    try {
      const response = await fetch(mirror.url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'NetSentinel-GeoIP-Builder' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${mirror.url}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100_000) {
        throw new Error(`File too small (${buffer.length} bytes) from ${mirror.url}`);
      }

      const digest = crypto.createHash('sha256').update(buffer).digest('hex');
      if (mirror.sha256Url) {
        const sumRes = await fetch(mirror.sha256Url, {
          redirect: 'follow',
          headers: { 'User-Agent': 'NetSentinel-GeoIP-Builder' },
        });
        if (!sumRes.ok) throw new Error(`SHA256 fetch failed HTTP ${sumRes.status}`);
        const expected = parseSha256Sum(await sumRes.text());
        if (!expected) throw new Error('Could not parse SHA256 checksum');
        if (expected !== digest) throw new Error(`SHA256 mismatch for ${mirror.url}`);
      }

      fs.writeFileSync(targetPath, buffer);
      fs.writeFileSync(`${targetPath}.sha256`, `${digest}\n`, 'utf8');
      console.log(`✅ GeoIP DB saved (${buffer.length} bytes, sha256=${digest.slice(0, 12)}…):`, targetPath);
      return;
    } catch (err) {
      lastError = err;
      console.warn('Mirror failed:', mirror.url, err.message);
    }
  }

  throw lastError || new Error('All GeoIP download mirrors failed');
}

downloadGeoIpForBundle().catch((err) => {
  console.error('❌ GeoIP bundle download failed:', err.message);
  process.exit(1);
});
