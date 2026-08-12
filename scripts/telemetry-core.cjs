const { execFile } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const maxmind = require('maxmind');
const npcapCapture = require('./npcap-capture.cjs');

const execFileAsync = util.promisify(execFile);

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

function isSuspicious(ip, port) {
  return port === 4444 || port === 9001 || ip.startsWith('185.220.') || ip.startsWith('45.154.');
}

/** Domain hints only — must NOT auto-trust / auto-verify sessions.
 *  Strict: exact famous IPs (or tiny private LAN hint). No wide prefix guesses. */
const FAMOUS_DOMAIN_BY_IP = Object.freeze({
  '8.8.8.8': 'dns.google',
  '8.8.4.4': 'dns.google',
  '1.1.1.1': 'one.one.one.one',
  '1.0.0.1': 'one.one.one.one',
  '9.9.9.9': 'dns.quad9.net',
  '149.112.112.112': 'dns.quad9.net',
  '208.67.222.222': 'dns.opendns.com',
  '208.67.220.220': 'dns.opendns.com',
  // Built-in trusted defaults in the app
  '192.168.1.1': 'router.home',
  '192.168.0.1': 'router.home',
  '192.168.219.1': 'router.home',
});

function resolveDomain(ip) {
  if (!ip || typeof ip !== 'string') return undefined;
  if (FAMOUS_DOMAIN_BY_IP[ip]) return FAMOUS_DOMAIN_BY_IP[ip];
  // Private LAN only as a generic local hint — not a public "company" guess
  if (isPrivateIp(ip)) return 'lan.local';
  return undefined;
}

function resolveCandidateDbPaths(extraPaths = []) {
  const roots = [
    ...extraPaths,
    path.join(__dirname, '..', 'data', GEOIP_DB_FILENAME),
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

function iconTypeForProcess(processName) {
  const lowerName = processName.toLowerCase();
  if (['chrome', 'edge', 'firefox', 'brave', 'whale'].some((k) => lowerName.includes(k))) return 'browser';
  if (['discord', 'slack', 'kakao', 'teams'].some((k) => lowerName.includes(k))) return 'chat';
  if (['code', 'idea', 'devenv', 'git'].some((k) => lowerName.includes(k))) return 'code';
  if (['steam', 'game', 'riot'].some((k) => lowerName.includes(k))) return 'game';
  if (['svchost', 'system', 'v3', 'asd'].some((k) => lowerName.includes(k))) return 'system';
  return 'default';
}

async function fetchTelemetryPayload() {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  try {
    await ensureGeoIp({ autoDownload: false });
  } catch (_) {}

  // Prefer Npcap when available
  let captureMode = 'netstat';
  let captureError = null;
  if (npcapCapture.isNpcapAvailable()) {
    const started = npcapCapture.startCapture();
    if (started.ok) captureMode = 'npcap';
    else captureError = started.error || null;
  }

  const npcapDelta = captureMode === 'npcap' ? npcapCapture.takeIntervalStats() : new Map();

  try {
    const { stdout: netstatOutput } = await execFileAsync(
      'netstat',
      ['-n', '-o', '-p', 'TCP'],
      {
        timeout: 2000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        encoding: 'utf8',
      }
    );

    const pidMap = new Map();
    try {
      const { stdout: tasklistOutput } = await execFileAsync(
        'tasklist',
        ['/FO', 'CSV', '/NH'],
        {
          timeout: 2000,
          maxBuffer: 5 * 1024 * 1024,
          windowsHide: true,
          encoding: 'utf8',
        }
      );
      for (const tLine of tasklistOutput.split('\n')) {
        const matches = tLine.trim().split(/","/);
        if (matches.length >= 2) {
          const name = matches[0].replace(/^"/, '');
          const pid = parseInt(matches[1].replace(/"$/, ''), 10);
          if (name && !isNaN(pid)) pidMap.set(pid, name);
        }
      }
    } catch (_) {}

    const sessionsMap = new Map();
    const processMap = new Map();

    for (const line of netstatOutput.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5 || parts[0] !== 'TCP' || parts[3] !== 'ESTABLISHED') continue;

      const foreignAddr = parts[2];
      const pid = parseInt(parts[4], 10) || 0;
      const processName = pidMap.get(pid) || (pid > 0 ? `Process-${pid}.exe` : 'System.exe');
      const lastColon = foreignAddr.lastIndexOf(':');
      if (lastColon === -1) continue;

      const ip = foreignAddr.substring(0, lastColon);
      const port = parseInt(foreignAddr.substring(lastColon + 1), 10) || 443;
      if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip.startsWith('[::')) continue;

      const live = npcapDelta.get(ip);
      let pIn;
      let pOut;
      let bIn;
      let bOut;

      if (captureMode === 'npcap' && live) {
        pIn = live.packetsIn;
        pOut = live.packetsOut;
        bIn = live.bytesIn;
        bOut = live.bytesOut;
      } else if (captureMode === 'npcap') {
        // Connected but quiet this interval
        pIn = 0;
        pOut = 0;
        bIn = 0;
        bOut = 0;
      } else {
        // Honest netstat mode: connection inventory only (no fake traffic volume)
        pIn = 0;
        pOut = 0;
        bIn = 0;
        bOut = 0;
      }

      const geo = resolveGeo(ip);

      if (!sessionsMap.has(ip)) {
        sessionsMap.set(ip, {
          id: `real-win-${ip.replace(/\./g, '-')}`,
          ip,
          domain: resolveDomain(ip),
          country: geo.country,
          country_code: geo.country_code,
          packets_in: pIn,
          packets_out: pOut,
          total_packets: pIn + pOut,
          bytes_in: bIn,
          bytes_out: bOut,
          total_bytes: bIn + bOut,
          last_seen: timeStr,
          status: isSuspicious(ip, port) ? 'suspicious' : 'new',
          protocol: 'TCP',
          port,
          is_baseline: false,
        });
      } else {
        const existing = sessionsMap.get(ip);
        existing.packets_in += pIn;
        existing.packets_out += pOut;
        existing.total_packets = existing.packets_in + existing.packets_out;
        existing.bytes_in += bIn;
        existing.bytes_out += bOut;
        existing.total_bytes = existing.bytes_in + existing.bytes_out;
        existing.last_seen = timeStr;
        existing.country = geo.country;
        existing.country_code = geo.country_code;
      }

      const procKey = `${processName}-${pid}`;
      if (!processMap.has(procKey)) {
        processMap.set(procKey, {
          processName,
          pid,
          packetsIn: pIn,
          packetsOut: pOut,
          totalPackets: pIn + pOut,
          bytesTotal: bIn + bOut,
          iconType: iconTypeForProcess(processName),
        });
      } else {
        const proc = processMap.get(procKey);
        proc.packetsIn += pIn;
        proc.packetsOut += pOut;
        proc.totalPackets = proc.packetsIn + proc.packetsOut;
        proc.bytesTotal += bIn + bOut;
      }
    }

    // Include Npcap-seen remotes that netstat didn't list this tick
    if (captureMode === 'npcap') {
      for (const [ip, live] of npcapDelta.entries()) {
        if (sessionsMap.has(ip)) continue;
        if (ip === '127.0.0.1' || ip.startsWith('127.')) continue;
        const geo = resolveGeo(ip);
        sessionsMap.set(ip, {
          id: `real-win-${ip.replace(/\./g, '-')}`,
          ip,
          domain: resolveDomain(ip),
          country: geo.country,
          country_code: geo.country_code,
          packets_in: live.packetsIn,
          packets_out: live.packetsOut,
          total_packets: live.packetsIn + live.packetsOut,
          bytes_in: live.bytesIn,
          bytes_out: live.bytesOut,
          total_bytes: live.bytesIn + live.bytesOut,
          last_seen: timeStr,
          status: 'new',
          protocol: 'IP',
          port: 0,
          is_baseline: false,
        });
      }
    }

    return {
      ok: true,
      source: captureMode,
      captureMode,
      captureError,
      sessions: Array.from(sessionsMap.values()),
      processes: Array.from(processMap.values()).sort((a, b) => b.bytesTotal - a.bytesTotal),
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      source: captureMode,
      captureMode,
      captureError,
      sessions: [],
      processes: [],
      error: err?.message || String(err),
    };
  }
}

module.exports = {
  GEOIP_DB_FILENAME,
  ensureGeoIp,
  updateGeoIp,
  getGeoIpStatus,
  fetchTelemetryPayload,
  resolveGeo,
  resolveDomain,
  resolveMyPublicGeo,
  getCaptureStatus: () => npcapCapture.getCaptureStatus(),
  startPacketCapture: (opts) => npcapCapture.startCapture(opts || {}),
  stopPacketCapture: () => npcapCapture.stopCapture(),
  listCaptureDevices: () => npcapCapture.listCaptureDevices(),
  setCaptureDevice: (deviceName) => npcapCapture.setPreferredDevice(deviceName),
};
