const { execFile } = require('child_process');
const util = require('util');
const npcapCapture = require('./npcap-capture.cjs');
const {
  GEOIP_DB_FILENAME,
  isPrivateIp,
  ensureGeoIp,
  updateGeoIp,
  getGeoIpStatus,
  downloadGeoIpDatabase,
  resolveGeo,
  resolveMyPublicGeo,
} = require('./lib/geoip-core.cjs');

const execFileAsync = util.promisify(execFile);

/** Domain hints only — must NOT auto-trust / auto-verify sessions.
 *  Strict: exact famous IPs (or tiny private LAN hint). No wide prefix guesses. */
const { FAMOUS_DOMAIN_BY_IP } = require('./lib/famous-ips.cjs');

function resolveDomain(ip) {
  if (!ip || typeof ip !== 'string') return undefined;
  if (FAMOUS_DOMAIN_BY_IP[ip]) return FAMOUS_DOMAIN_BY_IP[ip];
  // Private LAN only as a generic local hint — not a public "company" guess
  if (isPrivateIp(ip)) return 'lan.local';
  return undefined;
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
          status: 'new',
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
  downloadGeoIpDatabase,
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
