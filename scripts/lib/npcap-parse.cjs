/**
 * Ethernet / IPv4 frame parsing for Npcap capture (TCP + UDP).
 */
const DLT_EN10MB = 1;
const DLT_RAW = 12;
const DLT_IPV4 = 228;

const IP_PROTO_TCP = 6;
const IP_PROTO_UDP = 17;

/**
 * @param {object} deps
 * @param {() => Set<string>} deps.getLocalIpSet
 * @param {(ip: string, direction: 'in' | 'out', byteLen: number, meta?: { protocol?: string, port?: number }) => void} deps.addStat
 * @param {() => number} deps.getDatalink
 */
function createFrameHandler(deps) {
  function transportMeta(buf, ipOffset, ihl, ipProto, srcLocal, dstLocal) {
    const l4 = ipOffset + ihl;
    if (ipProto === IP_PROTO_TCP) {
      let port = 0;
      if (l4 + 4 <= buf.length) {
        const sport = buf.readUInt16BE(l4);
        const dport = buf.readUInt16BE(l4 + 2);
        // Remote port: outbound → dst, inbound → src
        if (srcLocal && !dstLocal) port = dport;
        else if (!srcLocal && dstLocal) port = sport;
        else port = dport || sport;
      }
      return { protocol: 'TCP', port };
    }
    if (ipProto === IP_PROTO_UDP) {
      let port = 0;
      if (l4 + 4 <= buf.length) {
        const sport = buf.readUInt16BE(l4);
        const dport = buf.readUInt16BE(l4 + 2);
        if (srcLocal && !dstLocal) port = dport;
        else if (!srcLocal && dstLocal) port = sport;
        else port = dport || sport;
      }
      return { protocol: 'UDP', port };
    }
    return { protocol: undefined, port: 0 };
  }

  function parseIpv4Packet(buf, offset, totalLen) {
    if (offset + 20 > buf.length) return;
    const vihl = buf[offset];
    const version = vihl >> 4;
    if (version !== 4) return;
    const ihl = (vihl & 0x0f) * 4;
    if (ihl < 20 || offset + ihl > buf.length) return;

    const ipProto = buf[offset + 9];
    const src = `${buf[offset + 12]}.${buf[offset + 13]}.${buf[offset + 14]}.${buf[offset + 15]}`;
    const dst = `${buf[offset + 16]}.${buf[offset + 17]}.${buf[offset + 18]}.${buf[offset + 19]}`;
    const payloadLen = Math.max(0, Math.min(totalLen, buf.length - offset));

    const localIpSet = deps.getLocalIpSet();
    const srcLocal = localIpSet.has(src);
    const dstLocal = localIpSet.has(dst);
    const meta = transportMeta(buf, offset, ihl, ipProto, srcLocal, dstLocal);

    if (srcLocal && !dstLocal) deps.addStat(dst, 'out', payloadLen, meta);
    else if (!srcLocal && dstLocal) deps.addStat(src, 'in', payloadLen, meta);
    else if (!srcLocal && !dstLocal) {
      deps.addStat(dst, 'out', Math.floor(payloadLen / 2), meta);
      deps.addStat(src, 'in', Math.ceil(payloadLen / 2), meta);
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
  IP_PROTO_TCP,
  IP_PROTO_UDP,
  createFrameHandler,
};
