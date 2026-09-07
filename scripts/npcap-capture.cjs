/**
 * Npcap live capture orchestration — bindings/parse live in scripts/lib/.
 */
const os = require('os');
const bindings = require('./lib/npcap-bindings.cjs');
const { DLT_EN10MB, createFrameHandler } = require('./lib/npcap-parse.cjs');
const { rankCaptureDevices } = require('./lib/npcap-devices.cjs');

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

function isNpcapAvailable() {
  return bindings.isNpcapAvailable();
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

const { handleFrame } = createFrameHandler({
  getLocalIpSet: () => localIpSet,
  addStat,
  getDatalink: () => datalink,
});

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

function drainPackets(maxPackets = 500) {
  if (!captureHandle) return;
  let count = 0;
  while (count < maxPackets) {
    const { rc, hdrPtr, dataPtr } = bindings.nextEx(captureHandle);
    if (rc === 0) break;
    if (rc === -1 || rc === -2) break;
    if (!hdrPtr[0] || !dataPtr[0]) break;

    const hdr = bindings.decodePacketHeader(hdrPtr[0]);
    const caplen = Math.min(Number(hdr.caplen) || 0, 65535);
    if (caplen <= 0) continue;

    try {
      handleFrame(bindings.decodePacketBytes(dataPtr[0], caplen), caplen);
    } catch (err) {
      try {
        const sliceLen = Math.min(caplen, 128);
        handleFrame(bindings.decodePacketBytes(dataPtr[0], sliceLen), sliceLen);
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
  if (!bindings.loadWpcap()) {
    startError = bindings.getLoadError();
    return { ok: false, mode: 'netstat', error: startError };
  }

  try {
    const { devices, alldevs } = bindings.listDevices();
    if (!devices.length) {
      bindings.freeAllDevs(alldevs);
      startError = 'No capture devices found';
      return { ok: false, mode: 'netstat', error: startError };
    }

    const preferred = options.deviceName || preferredDeviceName;
    const ranked = rankCaptureDevices(devices, preferred);

    let opened = null;
    let openedMeta = null;
    const errors = [];

    for (const { d } of ranked.slice(0, 8)) {
      for (const promisc of [0, 1]) {
        const { handle, error } = bindings.openLive(d.name, 65535, promisc, 10);
        if (handle) {
          opened = handle;
          openedMeta = { ...d, promisc };
          break;
        }
        errors.push(`${d.description || d.name} (promisc=${promisc}): ${error}`);
      }
      if (opened) break;
    }

    bindings.freeAllDevs(alldevs);

    if (!opened) {
      startError = errors[0] || 'pcap_open_live failed on all candidate devices';
      return { ok: false, mode: 'netstat', error: startError };
    }

    captureHandle = opened;
    currentDeviceLabel = openedMeta.description || openedMeta.name;
    currentDeviceName = openedMeta.name;
    datalink = bindings.readDatalink(captureHandle);
    bindings.setMinToCopy(captureHandle, 0);

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
    bindings.closeHandle(captureHandle);
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
  if (!bindings.loadWpcap()) return [];
  try {
    const { devices, alldevs } = bindings.listDevices();
    const scored = rankCaptureDevices(devices).map(({ d, score }) => ({
      name: d.name,
      description: d.description || d.name,
      score,
    }));
    bindings.freeAllDevs(alldevs);
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
