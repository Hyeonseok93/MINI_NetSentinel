const { execFile } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const maxmind = require('maxmind');

const execFileAsync = util.promisify(execFile);

/** Project root when this file lives in scripts/lib/ */
const PROJECT_ROOT = path.join(__dirname, '..', '..');

const GEOIP_DB_FILENAME = 'GeoLite2-Country.mmdb';
/** Only checksum-verified mirrors — unsigned fallbacks removed after audit. */
const GEOIP_DOWNLOAD_URLS = [
  {
    url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-Country.mmdb',
    sha256Url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-Country.mmdb.sha256sum',
  },
];

let geoReader = null;
let geoInitPromise = null;
const geoCache = new Map();

function isPrivateIp(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    ip === '127.0.0.1' ||
    ip.startsWith('169.254.')
  );
}

function resolveCandidateDbPaths(extraPaths = []) {
  const roots = [
    ...extraPaths,
    path.join(PROJECT_ROOT, 'data', GEOIP_DB_FILENAME),
    path.join(process.cwd(), 'data', GEOIP_DB_FILENAME),
  ];
  return [...new Set(roots.filter(Boolean))];
}

async function openGeoReaderFromPaths(paths) {
  for (const dbPath of paths) {
    if (!dbPath || !fs.existsSync(dbPath)) continue;
    try {
      geoReader = await maxmind.open(dbPath);
      geoCache.clear();
      return { ok: true, path: dbPath };
    } catch (err) {
      console.error('[telemetry] failed to open GeoIP DB:', dbPath, err.message);
    }
  }
  geoReader = null;
  return { ok: false, path: null };
}

function parseSha256Sum(text) {
  const line = String(text || '').trim().split(/\r?\n/)[0] || '';
  const match = line.match(/^([a-fA-F0-9]{64})\s+/);
  return match ? match[1].toLowerCase() : null;
}

async function downloadGeoIpDatabase(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.download`;
  let lastError = null;

  for (const mirror of GEOIP_DOWNLOAD_URLS) {
    try {
      const response = await fetch(mirror.url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'NetSentinel-Telemetry-Core' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${mirror.url}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100_000) {
        throw new Error(`Downloaded file too small (${buffer.length} bytes)`);
      }

      const digest = crypto.createHash('sha256').update(buffer).digest('hex');
      if (!mirror.sha256Url) {
        throw new Error(`Mirror missing SHA256 URL: ${mirror.url}`);
      }
      const sumRes = await fetch(mirror.sha256Url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'NetSentinel-Telemetry-Core' },
      });
      if (!sumRes.ok) throw new Error(`SHA256 fetch failed HTTP ${sumRes.status}`);
      const expected = parseSha256Sum(await sumRes.text());
      if (!expected) throw new Error('Could not parse SHA256 checksum file');
      if (expected !== digest) {
        throw new Error(`SHA256 mismatch (expected ${expected}, got ${digest})`);
      }

      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, targetPath);
      fs.writeFileSync(`${targetPath}.sha256`, `${digest}\n`, 'utf8');
      return targetPath;
    } catch (err) {
      lastError = err;
      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {}
      }
    }
  }
  throw lastError || new Error('All GeoIP download mirrors failed');
}

function getGeoIpStatus(activePath) {
  const exists = Boolean(activePath && fs.existsSync(activePath));
  let lastUpdated = null;
  let sizeBytes = 0;
  if (exists) {
    const stat = fs.statSync(activePath);
    lastUpdated = stat.mtime.toISOString();
    sizeBytes = stat.size;
  }
  return {
    active: Boolean(geoReader),
    exists,
    path: exists ? activePath : null,
    lastUpdated,
    sizeBytes,
    label: exists
      ? `${new Date(lastUpdated).toLocaleString()} (Up-to-date)`
      : 'Not installed — click Update to download',
  };
}

async function ensureGeoIp(options = {}) {
  if (geoInitPromise) return geoInitPromise;

  geoInitPromise = (async () => {
    const writablePath = options.writablePath || path.join(process.cwd(), 'data', GEOIP_DB_FILENAME);
    const candidates = resolveCandidateDbPaths([writablePath, ...(options.extraPaths || [])]);
    let opened = await openGeoReaderFromPaths(candidates);
    if (opened.ok) return getGeoIpStatus(opened.path);

    if (options.autoDownload !== false) {
      try {
        await downloadGeoIpDatabase(writablePath);
        opened = await openGeoReaderFromPaths([writablePath]);
        return getGeoIpStatus(opened.path);
      } catch (err) {
        console.error('[telemetry] GeoIP auto-download failed:', err.message);
      }
    }
    return getGeoIpStatus(null);
  })();

  try {
    return await geoInitPromise;
  } finally {
    // Allow retries after failure
    if (!geoReader) geoInitPromise = null;
  }
}

async function updateGeoIp(writablePath) {
  const target = writablePath || path.join(process.cwd(), 'data', GEOIP_DB_FILENAME);
  await downloadGeoIpDatabase(target);
  geoInitPromise = null;
  const opened = await openGeoReaderFromPaths([target]);
  return getGeoIpStatus(opened.path);
}

function resolveGeo(ip) {
  if (isPrivateIp(ip)) {
    return { country: 'Local Network', country_code: 'LAN' };
  }
  if (geoCache.has(ip)) return geoCache.get(ip);

  if (!geoReader) {
    return { country: 'Unknown Location', country_code: 'NET' };
  }

  try {
    const result = geoReader.get(ip);
    const country = result?.country || result?.registered_country;
    const code = country?.iso_code;
    const name = country?.names?.en;
    const resolved =
      code && name
        ? { country: name, country_code: code }
        : { country: 'Unknown Location', country_code: 'NET' };
    geoCache.set(ip, resolved);
    return resolved;
  } catch {
    return { country: 'Unknown Location', country_code: 'NET' };
  }
}

function timezoneFallbackGeo() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Seoul') || tz.includes('Korea')) {
      return { country: 'South Korea', country_code: 'KR', source: 'timezone' };
    }
    if (tz.includes('Tokyo')) return { country: 'Japan', country_code: 'JP', source: 'timezone' };
    if (tz.includes('Shanghai') || tz.includes('Hong_Kong')) {
      return { country: 'China', country_code: 'CN', source: 'timezone' };
    }
    if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) {
      return { country: 'United States', country_code: 'US', source: 'timezone' };
    }
  } catch (_) {}
  return { country: 'Unknown Location', country_code: 'NET', source: 'timezone' };
}

async function discoverPublicIp() {
  // DNS-only discovery (not a third-party Geo API). Fails cleanly offline.
  try {
    const { stdout } = await execFileAsync(
      'nslookup',
      ['myip.opendns.com', 'resolver1.opendns.com'],
      {
        timeout: 2500,
        windowsHide: true,
        encoding: 'utf8',
      }
    );
    const matches = [...String(stdout).matchAll(/Address:\s*([0-9.]+)/gi)];
    // Last Address line is typically the resolved public IP
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const ip = matches[i][1];
      if (ip && !ip.startsWith('208.67.') && !isPrivateIp(ip)) return ip;
    }
  } catch (_) {}
  return null;
}

function readPublicIpCache(cachePath) {
  try {
    if (!cachePath || !fs.existsSync(cachePath)) return null;
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (raw && typeof raw.ip === 'string') {
      const parts = raw.ip.split('.').map((n) => Number(n));
      const ok =
        /^\d{1,3}(\.\d{1,3}){3}$/.test(raw.ip) &&
        parts.length === 4 &&
        parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
      if (ok) return raw.ip;
    }
  } catch (_) {}
  return null;
}

function writePublicIpCache(cachePath, ip) {
  if (!cachePath || !ip) return;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(
      cachePath,
      JSON.stringify({ ip, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (_) {}
}

/**
 * Resolve this machine's country using local GeoLite2 only.
 * Optional DNS is used only to learn the public IP (never a remote geo API).
 * Offline: cached public IP + mmdb, else timezone fallback.
 */
async function resolveMyPublicGeo(options = {}) {
  await ensureGeoIp({
    writablePath: options.writablePath,
    extraPaths: options.extraPaths || [],
    autoDownload: false,
  });

  const cachePath = options.cachePath || null;
  let publicIp = null;
  let ipSource = 'none';

  const discovered = await discoverPublicIp();
  if (discovered) {
    publicIp = discovered;
    ipSource = 'dns';
    writePublicIpCache(cachePath, publicIp);
  } else {
    const cached = readPublicIpCache(cachePath);
    if (cached) {
      publicIp = cached;
      ipSource = 'cache';
    }
  }

  if (publicIp && geoReader) {
    const geo = resolveGeo(publicIp);
    return {
      country: geo.country,
      countryCode: geo.country_code,
      country_code: geo.country_code,
      publicIp,
      source: `mmdb:${ipSource}`,
    };
  }

  const fb = timezoneFallbackGeo();
  return {
    country: fb.country,
    countryCode: fb.country_code,
    country_code: fb.country_code,
    publicIp: publicIp || null,
    source: fb.source,
  };
}

module.exports = {
  GEOIP_DB_FILENAME,
  isPrivateIp,
  ensureGeoIp,
  updateGeoIp,
  getGeoIpStatus,
  downloadGeoIpDatabase,
  resolveGeo,
  resolveMyPublicGeo,
};
