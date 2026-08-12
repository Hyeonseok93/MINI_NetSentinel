const fs = require('fs');
const path = require('path');
const os = require('os');
const koffi = require('koffi');

const PCAP_ERRBUF_SIZE = 256;
const DLT_EN10MB = 1;
const DLT_RAW = 12;
const DLT_IPV4 = 228;

let wpcap = null;
let pcapFindalldevs = null;
let pcapFreealldevs = null;
let pcapOpenLive = null;
let pcapClose = null;
let pcapNextEx = null;
let pcapDatalink = null;
let pcapSetmintocopy = null;

let captureHandle = null;
let datalink = DLT_EN10MB;
let pollTimer = null;
let started = false;
let startError = null;
let localIpSet = new Set();
let preferredDeviceName = null;
let currentDeviceName = null;
let currentDeviceLabel = null;

/** Soft-evict IPs with no packets for this long (delta math stays correct on reappear). */
const CUMULATIVE_IDLE_TTL_MS = 15 * 60 * 1000;
/** Hard cap so long-running capture cannot grow the map without bound. */
const MAX_CUMULATIVE_IPS = 10000;

/**
 * Lifetime counters per remote IP (for interval deltas only — not UI history).
 * @type {Map<string, { packetsIn: number, packetsOut: number, bytesIn: number, bytesOut: number, lastSeenMs: number }>}
 */
const cumulative = new Map();
/** @type {Map<string, { packetsIn: number, packetsOut: number, bytesIn: number, bytesOut: number }>} */
let lastSnapshot = new Map();

function findWpcapPath() {
  const candidates = [
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'Npcap', 'wpcap.dll'),
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wpcap.dll'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function isNpcapAvailable() {
  return Boolean(findWpcapPath());
}

function refreshLocalIps() {
  localIpSet = new Set();
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const item of list) {
      if (item.family === 'IPv4' || item.family === 4) {
        localIpSet.add(item.address);
      }
    }
  }
}

function loadWpcap() {
  if (wpcap) return true;
  const dllPath = findWpcapPath();
  if (!dllPath) {
    startError = 'Npcap wpcap.dll not found';
    return false;
  }

  try {
    // Ensure Packet.dll resolution from Npcap folder
    const dir = path.dirname(dllPath);
    try {
      const kernel32 = koffi.load('kernel32.dll');
      const SetDllDirectoryW = kernel32.func('int __stdcall SetDllDirectoryW(const char16_t *lpPathName)');
      SetDllDirectoryW(dir);
    } catch (_) {}

    wpcap = koffi.load(dllPath);

    const PcapIf = koffi.struct('pcap_if', {
      next: 'void *',
      name: 'str',
      description: 'str',
      addresses: 'void *',
      flags: 'uint32',
    });

    koffi.struct('timeval', {
      tv_sec: 'long',
      tv_usec: 'long',
    });

    const PcapPkthdr = koffi.struct('pcap_pkthdr', {
      ts: 'timeval',
      caplen: 'uint32',
      len: 'uint32',
    });

    pcapFindalldevs = wpcap.func('int __cdecl pcap_findalldevs(_Out_ void **alldevsp, _Out_ char *errbuf)');
    pcapFreealldevs = wpcap.func('void __cdecl pcap_freealldevs(void *alldevs)');
    pcapOpenLive = wpcap.func(
      'void *__cdecl pcap_open_live(const char *device, int snaplen, int promisc, int to_ms, _Out_ char *errbuf)'
    );
    pcapClose = wpcap.func('void __cdecl pcap_close(void *p)');
    pcapNextEx = wpcap.func(
      'int __cdecl pcap_next_ex(void *p, _Out_ void **pkt_header, _Out_ void **pkt_data)'
    );
    pcapDatalink = wpcap.func('int __cdecl pcap_datalink(void *p)');
    try {
      pcapSetmintocopy = wpcap.func('int __cdecl pcap_setmintocopy(void *p, int size)');
    } catch (_) {
      pcapSetmintocopy = null;
    }

    // Keep refs so GC doesn't collect struct types
    void PcapIf;
    void PcapPkthdr;
    return true;
  } catch (err) {
    startError = err.message || String(err);
    wpcap = null;
    return false;
  }
}

function listDevices() {
  const errbuf = Buffer.alloc(PCAP_ERRBUF_SIZE);
  const alldevsp = [null];
  const rc = pcapFindalldevs(alldevsp, errbuf);
  if (rc !== 0 || !alldevsp[0]) {
    throw new Error(errbuf.toString('utf8').replace(/\0.*$/, '') || 'pcap_findalldevs failed');
  }

  const devices = [];
  let ptr = alldevsp[0];
  const PcapIf = koffi.type('pcap_if');
  while (ptr) {
    const dev = koffi.decode(ptr, PcapIf);
    if (dev.name) {
      devices.push({
        name: dev.name,
        description: dev.description || '',
        ptr,
      });
    }
    ptr = dev.next;
  }
  return { devices, alldevs: alldevsp[0] };
}

function addStat(ip, direction, byteLen) {
  if (!ip || ip === '0.0.0.0' || ip.startsWith('127.')) return;
  let row = cumulative.get(ip);
  if (!row) {
    row = { packetsIn: 0, packetsOut: 0, bytesIn: 0, bytesOut: 0, lastSeenMs: 0 };
    cumulative.set(ip, row);
  }
  if (direction === 'in') {
    row.packetsIn += 1;
    row.bytesIn += byteLen;
  } else {
    row.packetsOut += 1;
    row.bytesOut += byteLen;
  }
  row.lastSeenMs = Date.now();
}

/**
 * Drop idle / excess IPs from both cumulative and lastSnapshot together.
 * Safe for delta math: a reappearing IP starts at 0 and lastSnapshot has no prev → first interval counts correctly.
 */
function pruneCumulativeMaps(now = Date.now()) {
  for (const [ip, row] of cumulative.entries()) {
    if (now - (row.lastSeenMs || 0) > CUMULATIVE_IDLE_TTL_MS) {
      cumulative.delete(ip);
      lastSnapshot.delete(ip);
    }
  }

  if (cumulative.size <= MAX_CUMULATIVE_IPS) return;

  const ranked = [...cumulative.entries()].sort(
    (a, b) => (a[1].lastSeenMs || 0) - (b[1].lastSeenMs || 0)
  );
  const excess = cumulative.size - MAX_CUMULATIVE_IPS;
  for (let i = 0; i < excess; i++) {
    const ip = ranked[i][0];
    cumulative.delete(ip);
    lastSnapshot.delete(ip);
  }
}

function clearCumulativeMaps() {
  cumulative.clear();
  lastSnapshot.clear();
}

function parseIpv4Packet(buf, offset, totalLen) {
  if (offset + 20 > buf.length) return;
  const vihl = buf[offset];
  const version = vihl >> 4;
  if (version !== 4) return;
  const ihl = (vihl & 0x0f) * 4;
  if (ihl < 20 || offset + ihl > buf.length) return;

  const src = `${buf[offset + 12]}.${buf[offset + 13]}.${buf[offset + 14]}.${buf[offset + 15]}`;
  const dst = `${buf[offset + 16]}.${buf[offset + 17]}.${buf[offset + 18]}.${buf[offset + 19]}`;
  const payloadLen = Math.max(0, Math.min(totalLen, buf.length - offset));

  const srcLocal = localIpSet.has(src);
  const dstLocal = localIpSet.has(dst);

  if (srcLocal && !dstLocal) addStat(dst, 'out', payloadLen);
  else if (!srcLocal && dstLocal) addStat(src, 'in', payloadLen);
  else if (!srcLocal && !dstLocal) {
    // Forwarded/other — count both as outbound-ish remote peers
    addStat(dst, 'out', Math.floor(payloadLen / 2));
    addStat(src, 'in', Math.ceil(payloadLen / 2));
  }
}

function handleFrame(rawBuf, caplen) {
  const buf = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(rawBuf);
  const len = Math.min(caplen, buf.length);

  if (datalink === DLT_EN10MB) {
    if (len < 14) return;
    const ethertype = buf.readUInt16BE(12);
    if (ethertype === 0x0800) {
      parseIpv4Packet(buf, 14, len - 14);
    } else if (ethertype === 0x8100 && len >= 18) {
      const inner = buf.readUInt16BE(16);
      if (inner === 0x0800) parseIpv4Packet(buf, 18, len - 18);
    }
  } else if (datalink === DLT_RAW || datalink === DLT_IPV4) {
    parseIpv4Packet(buf, 0, len);
  }
}

function drainPackets(maxPackets = 500) {
  if (!captureHandle) return;
  const PcapPkthdr = koffi.type('pcap_pkthdr');
  let count = 0;
  while (count < maxPackets) {
    const hdrPtr = [null];
    const dataPtr = [null];
    const rc = pcapNextEx(captureHandle, hdrPtr, dataPtr);
    if (rc === 0) break;
    if (rc === -1 || rc === -2) break;
    if (!hdrPtr[0] || !dataPtr[0]) break;

    const hdr = koffi.decode(hdrPtr[0], PcapPkthdr);
    const caplen = Math.min(Number(hdr.caplen) || 0, 65535);
    if (caplen <= 0) continue;

    try {
      const bytes = koffi.decode(dataPtr[0], koffi.array('uint8', caplen));
      handleFrame(Uint8Array.from(bytes), caplen);
    } catch (err) {
      // Fallback: decode only Ethernet+IP header window
      try {
        const sliceLen = Math.min(caplen, 128);
        const bytes = koffi.decode(dataPtr[0], koffi.array('uint8', sliceLen));
        handleFrame(Uint8Array.from(bytes), sliceLen);
      } catch (err2) {
        startError = err2.message || String(err2);
        break;
      }
    }
    count += 1;
  }
}

function startCapture(options = {}) {
  if (started) {
    return {
      ok: true,
      mode: 'npcap',
      device: currentDeviceLabel,
      deviceName: currentDeviceName,
    };
  }
  startError = null;
  refreshLocalIps();

  if (!isNpcapAvailable()) {
    startError = 'Npcap not installed';
    return { ok: false, mode: 'netstat', error: startError };
  }
  if (!loadWpcap()) {
    return { ok: false, mode: 'netstat', error: startError };
  }

  try {
    const { devices, alldevs } = listDevices();
    if (!devices.length) {
      pcapFreealldevs(alldevs);
      startError = 'No capture devices found';
      return { ok: false, mode: 'netstat', error: startError };
    }

    const preferred = options.deviceName || preferredDeviceName;
    const ranked = devices
      .map((d) => {
        const desc = `${d.description} ${d.name}`.toLowerCase();
        let score = 0;
        if (preferred && (d.name === preferred || d.description === preferred)) score += 1000;
        if (
          desc.includes('loopback') ||
          desc.includes('npcap loopback') ||
          desc.includes('hyper-v') ||
          desc.includes('vmware') ||
          desc.includes('virtualbox') ||
          desc.includes('bluetooth') ||
          desc.includes('wan miniport') ||
          desc.includes('vpn') ||
          desc.includes('virtual')
        ) {
          score -= 100;
        }
        if (desc.includes('wi-fi') || desc.includes('wifi') || desc.includes('wlan') || desc.includes('802.11')) score += 40;
        if (desc.includes('realtek') || desc.includes('intel') || desc.includes('broadcom') || desc.includes('qualcomm')) {
          score += 35;
        }
        if (desc.includes('gbe') || desc.includes('gigabit') || desc.includes('ethernet')) score += 20;
        if (d.description) score += 5;
        return { d, score };
      })
      .sort((a, b) => b.score - a.score);

    let opened = null;
    let openedMeta = null;
    const errors = [];

    for (const { d } of ranked.slice(0, 8)) {
      const errbuf = Buffer.alloc(PCAP_ERRBUF_SIZE);
      for (const promisc of [0, 1]) {
        const handle = pcapOpenLive(d.name, 65535, promisc, 10, errbuf);
        if (handle) {
          opened = handle;
          openedMeta = { ...d, promisc };
          break;
        }
        errors.push(`${d.description || d.name} (promisc=${promisc}): ${errbuf.toString('utf8').replace(/\0.*$/, '')}`);
      }
      if (opened) break;
    }

    pcapFreealldevs(alldevs);

    if (!opened) {
      startError = errors[0] || 'pcap_open_live failed on all candidate devices';
      return { ok: false, mode: 'netstat', error: startError };
    }

    captureHandle = opened;
    currentDeviceLabel = openedMeta.description || openedMeta.name;
    currentDeviceName = openedMeta.name;
    datalink = pcapDatalink(captureHandle);
    if (pcapSetmintocopy) {
      try {
        pcapSetmintocopy(captureHandle, 0);
      } catch (_) {}
    }

    started = true;
    pollTimer = setInterval(() => {
      try {
        refreshLocalIps();
        drainPackets(800);
      } catch (err) {
        startError = err.message || String(err);
      }
    }, 200);
    if (pollTimer.unref) pollTimer.unref();

    return {
      ok: true,
      mode: 'npcap',
      device: currentDeviceLabel,
      deviceName: currentDeviceName,
      promisc: openedMeta.promisc,
    };
  } catch (err) {
    startError = err.message || String(err);
    stopCapture();
    return { ok: false, mode: 'netstat', error: startError };
  }
}

function stopCapture() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (captureHandle) {
    try {
      pcapClose(captureHandle);
    } catch (_) {}
    captureHandle = null;
  }
  started = false;
  currentDeviceName = null;
  currentDeviceLabel = null;
  clearCumulativeMaps();
}

function getCaptureMode() {
  return started ? 'npcap' : 'netstat';
}

function listCaptureDevices() {
  if (!isNpcapAvailable()) return [];
  if (!loadWpcap()) return [];
  try {
    const { devices, alldevs } = listDevices();
    const scored = devices
      .map((d) => {
        const desc = `${d.description} ${d.name}`.toLowerCase();
        let score = 0;
        if (
          desc.includes('loopback') ||
          desc.includes('npcap loopback') ||
          desc.includes('hyper-v') ||
          desc.includes('vmware') ||
          desc.includes('virtualbox') ||
          desc.includes('bluetooth') ||
          desc.includes('wan miniport') ||
          desc.includes('vpn') ||
          desc.includes('virtual')
        ) {
          score -= 100;
        }
        if (desc.includes('wi-fi') || desc.includes('wifi') || desc.includes('wlan') || desc.includes('802.11')) score += 40;
        if (desc.includes('realtek') || desc.includes('intel') || desc.includes('broadcom') || desc.includes('qualcomm')) {
          score += 35;
        }
        if (desc.includes('gbe') || desc.includes('gigabit') || desc.includes('ethernet')) score += 20;
        if (d.description) score += 5;
        return {
          name: d.name,
          description: d.description || d.name,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    pcapFreealldevs(alldevs);
    return scored.map(({ name, description }) => ({ name, description }));
  } catch {
    return [];
  }
}

function setPreferredDevice(deviceName) {
  preferredDeviceName = deviceName || null;
  if (started) {
    stopCapture();
    return startCapture({ deviceName: preferredDeviceName });
  }
  return { ok: true, mode: getCaptureMode() };
}

function getCaptureStatus() {
  return {
    mode: getCaptureMode(),
    started,
    npcapAvailable: isNpcapAvailable(),
    error: startError,
    device: currentDeviceLabel,
    deviceName: currentDeviceName,
    preferredDeviceName,
    cumulativeIpCount: cumulative.size,
  };
}

function takeIntervalStats() {
  if (started) {
    try {
      drainPackets(1000);
    } catch (_) {}
  }

  /** @type {Map<string, { packetsIn: number, packetsOut: number, bytesIn: number, bytesOut: number }>} */
  const delta = new Map();
  for (const [ip, cur] of cumulative.entries()) {
    const prev = lastSnapshot.get(ip) || { packetsIn: 0, packetsOut: 0, bytesIn: 0, bytesOut: 0 };
    const d = {
      packetsIn: Math.max(0, cur.packetsIn - prev.packetsIn),
      packetsOut: Math.max(0, cur.packetsOut - prev.packetsOut),
      bytesIn: Math.max(0, cur.bytesIn - prev.bytesIn),
      bytesOut: Math.max(0, cur.bytesOut - prev.bytesOut),
    };
    if (d.packetsIn || d.packetsOut || d.bytesIn || d.bytesOut) {
      delta.set(ip, d);
    }
  }

  pruneCumulativeMaps();

  lastSnapshot = new Map(
    [...cumulative.entries()].map(([ip, v]) => [
      ip,
      {
        packetsIn: v.packetsIn,
        packetsOut: v.packetsOut,
        bytesIn: v.bytesIn,
        bytesOut: v.bytesOut,
      },
    ])
  );

  return delta;
}

module.exports = {
  isNpcapAvailable,
  startCapture,
  stopCapture,
  getCaptureMode,
  getCaptureStatus,
  takeIntervalStats,
  listCaptureDevices,
  setPreferredDevice,
};
