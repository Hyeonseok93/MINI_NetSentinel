/**
 * Ethernet / IPv4 frame parsing for Npcap capture.
 */
const DLT_EN10MB = 1;
const DLT_RAW = 12;
const DLT_IPV4 = 228;

/**
 * @param {object} deps
 * @param {() => Set<string>} deps.getLocalIpSet
 * @param {(ip: string, direction: 'in' | 'out', byteLen: number) => void} deps.addStat
 * @param {() => number} deps.getDatalink
 */
function createFrameHandler(deps) {
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

    const localIpSet = deps.getLocalIpSet();
    const srcLocal = localIpSet.has(src);
    const dstLocal = localIpSet.has(dst);

    if (srcLocal && !dstLocal) deps.addStat(dst, 'out', payloadLen);
    else if (!srcLocal && dstLocal) deps.addStat(src, 'in', payloadLen);
    else if (!srcLocal && !dstLocal) {
      deps.addStat(dst, 'out', Math.floor(payloadLen / 2));
      deps.addStat(src, 'in', Math.ceil(payloadLen / 2));
    }
  }

  function handleFrame(rawBuf, caplen) {
    const buf = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(rawBuf);
    const len = Math.min(caplen, buf.length);
    const datalink = deps.getDatalink();

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

  return { handleFrame, parseIpv4Packet };
}

module.exports = {
  DLT_EN10MB,
  DLT_RAW,
  DLT_IPV4,
  createFrameHandler,
};
