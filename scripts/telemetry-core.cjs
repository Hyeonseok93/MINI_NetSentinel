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
const { isValidIpv4 } = require('./lib/ipv4.cjs');

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

function parseForeignAddr(foreignAddr) {
  if (!foreignAddr || foreignAddr === '*:*' || foreignAddr.startsWith('[')) return null;
  const lastColon = foreignAddr.lastIndexOf(':');
  if (lastColon === -1) return null;
  const ip = foreignAddr.substring(0, lastColon);
  const port = parseInt(foreignAddr.substring(lastColon + 1), 10);
  if (!isValidIpv4(ip)) return null;
  if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip.startsWith('127.')) return null;
  if (!Number.isFinite(port) || port < 0) return null;
  return { ip, port: port || 0 };
}

function trafficForIp(captureMode, npcapDelta, ip) {
  const live = npcapDelta.get(ip);
  if (captureMode === 'npcap' && live) {
    return {
      pIn: live.packetsIn,
      pOut: live.packetsOut,
      bIn: live.bytesIn,
      bOut: live.bytesOut,
    };
  }
  return { pIn: 0, pOut: 0, bIn: 0, bOut: 0 };
}

function upsertSession(sessionsMap, { ip, port, protocol, timeStr, captureMode, npcapDelta }) {
  const { pIn, pOut, bIn, bOut } = trafficForIp(captureMode, npcapDelta, ip);
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
      protocol,
      port,
      is_baseline: false,
      _fromTcp: protocol === 'TCP',
      _fromUdp: protocol === 'UDP',
    });
    return;
  }

  const existing = sessionsMap.get(ip);
  // Traffic already applied when first created from this IP; avoid double-counting
  // when both TCP and UDP netstat list the same remote in one tick.
  existing.last_seen = timeStr;
  existing.country = geo.country;
  existing.country_code = geo.country_code;

  if (protocol === 'TCP') {
    existing._fromTcp = true;
    existing.protocol = 'TCP';
    if (port > 0) existing.port = port;
  } else if (protocol === 'UDP') {
    existing._fromUdp = true;
    if (!existing._fromTcp) {
      existing.protocol = 'UDP';
      if (port > 0) existing.port = port;
    }
  }
}

function addProcessTraffic(processMap, processName, pid, pIn, pOut, bIn, bOut) {
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
    const netstatOpts = {
      timeout: 2000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
    };

    const [tcpResult, udpResult] = await Promise.all([
      execFileAsync('netstat', ['-n', '-o', '-p', 'TCP'], netstatOpts),
      execFileAsync('netstat', ['-n', '-o', '-p', 'UDP'], netstatOpts).catch(async () => {
        // Some Windows builds dislike -o with -p UDP; fall back to address-only list.
        try {
          return await execFileAsync('netstat', ['-an', '-p', 'UDP'], netstatOpts);
        } catch {
          return { stdout: '' };
        }
      }),
    ]);

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
    /** Track which IPs already received interval traffic into sessions/process maps */
    const trafficApplied = new Set();

    function applyEndpoint({ protocol, ip, port, pid }) {
      const processName = pidMap.get(pid) || (pid > 0 ? `Process-${pid}.exe` : 'System.exe');
      const already = trafficApplied.has(ip);
      const { pIn, pOut, bIn, bOut } = already
        ? { pIn: 0, pOut: 0, bIn: 0, bOut: 0 }
        : trafficForIp(captureMode, npcapDelta, ip);

      if (!already) {
        trafficApplied.add(ip);
        const geo = resolveGeo(ip);
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
          protocol,
          port,
          is_baseline: false,
          _fromTcp: protocol === 'TCP',
          _fromUdp: protocol === 'UDP',
        });
        addProcessTraffic(processMap, processName, pid, pIn, pOut, bIn, bOut);
      } else {
        upsertSession(sessionsMap, { ip, port, protocol, timeStr, captureMode, npcapDelta });
        // Process map: only attribute non-zero when first seen; skip double count
      }
    }

    for (const line of String(tcpResult.stdout || '').split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5 || parts[0] !== 'TCP' || parts[3] !== 'ESTABLISHED') continue;
      const parsed = parseForeignAddr(parts[2]);
      if (!parsed) continue;
      const pid = parseInt(parts[4], 10) || 0;
      applyEndpoint({ protocol: 'TCP', ip: parsed.ip, port: parsed.port, pid });
    }

    for (const line of String(udpResult.stdout || '').split('\n')) {
      const parts = line.trim().split(/\s+/);
      // UDP local foreign [pid] — pid optional when using netstat -an
      if (parts.length < 3 || parts[0] !== 'UDP') continue;
      const parsed = parseForeignAddr(parts[2]);
      if (!parsed) continue;
      const pid = parts.length >= 4 ? parseInt(parts[3], 10) || 0 : 0;
      applyEndpoint({ protocol: 'UDP', ip: parsed.ip, port: parsed.port, pid });
    }

    // Include Npcap-seen remotes that netstat didn't list this tick
    if (captureMode === 'npcap') {
      for (const [ip, live] of npcapDelta.entries()) {
        if (sessionsMap.has(ip)) continue;
        if (ip === '127.0.0.1' || ip.startsWith('127.')) continue;
        if (!isValidIpv4(ip)) continue;
        const geo = resolveGeo(ip);
        let protocol = 'TCP';
        if (live.protocol === 'UDP' || (live.sawUdp && !live.sawTcp)) protocol = 'UDP';
        else if (live.protocol === 'TCP' || live.sawTcp) protocol = 'TCP';
        else if (live.sawUdp) protocol = 'UDP';

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
          protocol,
          port: live.port || 0,
          is_baseline: false,
        });
      }
    }

    // Strip internal merge flags
    const sessions = Array.from(sessionsMap.values()).map((s) => {
      const { _fromTcp, _fromUdp, ...rest } = s;
      return rest;
    });

    return {
      ok: true,
      source: captureMode,
      captureMode,
      captureError,
      sessions,
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
  // test helpers
  parseForeignAddr,
};
