/**
 * Npcap / wpcap.dll koffi bindings + device enumeration.
 */
const fs = require('fs');
const path = require('path');
const koffi = require('koffi');

const PCAP_ERRBUF_SIZE = 256;

let wpcap = null;
let pcapFindalldevs = null;
let pcapFreealldevs = null;
let pcapOpenLive = null;
let pcapClose = null;
let pcapNextEx = null;
let pcapDatalink = null;
let pcapSetmintocopy = null;
let loadError = null;

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

function getLoadError() {
  return loadError;
}

function loadWpcap() {
  if (wpcap) return true;
  loadError = null;
  const dllPath = findWpcapPath();
  if (!dllPath) {
    loadError = 'Npcap wpcap.dll not found';
    return false;
  }

  try {
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

    void PcapIf;
    void PcapPkthdr;
    return true;
  } catch (err) {
    loadError = err.message || String(err);
    wpcap = null;
    return false;
  }
}

function getApi() {
  return {
    pcapFindalldevs,
    pcapFreealldevs,
    pcapOpenLive,
    pcapClose,
    pcapNextEx,
    pcapDatalink,
    pcapSetmintocopy,
  };
}

function listDevices() {
  if (!pcapFindalldevs || !pcapFreealldevs) {
    throw new Error('wpcap not loaded');
  }
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

function freeAllDevs(alldevs) {
  if (alldevs && pcapFreealldevs) pcapFreealldevs(alldevs);
}

function openLive(deviceName, snaplen, promisc, timeoutMs) {
  const errbuf = Buffer.alloc(PCAP_ERRBUF_SIZE);
  const handle = pcapOpenLive(deviceName, snaplen, promisc, timeoutMs, errbuf);
  return {
    handle,
    error: errbuf.toString('utf8').replace(/\0.*$/, ''),
  };
}

function closeHandle(handle) {
  if (handle && pcapClose) {
    try {
      pcapClose(handle);
    } catch (_) {}
  }
}

function readDatalink(handle) {
  return pcapDatalink ? pcapDatalink(handle) : 1;
}

function setMinToCopy(handle, size) {
  if (!pcapSetmintocopy) return;
  try {
    pcapSetmintocopy(handle, size);
  } catch (_) {}
}

function nextEx(handle) {
  const hdrPtr = [null];
  const dataPtr = [null];
  const rc = pcapNextEx(handle, hdrPtr, dataPtr);
  return { rc, hdrPtr, dataPtr };
}

function decodePacketHeader(hdrPtr) {
  const PcapPkthdr = koffi.type('pcap_pkthdr');
  return koffi.decode(hdrPtr, PcapPkthdr);
}

function decodePacketBytes(dataPtr, caplen) {
  const bytes = koffi.decode(dataPtr, koffi.array('uint8', caplen));
  return Uint8Array.from(bytes);
}

module.exports = {
  PCAP_ERRBUF_SIZE,
  findWpcapPath,
  isNpcapAvailable,
  getLoadError,
  loadWpcap,
  getApi,
  listDevices,
  freeAllDevs,
  openLive,
  closeHandle,
  readDatalink,
  setMinToCopy,
  nextEx,
  decodePacketHeader,
  decodePacketBytes,
};
