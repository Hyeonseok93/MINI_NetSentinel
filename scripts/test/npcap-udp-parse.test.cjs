const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createFrameHandler, DLT_EN10MB, IP_PROTO_UDP, IP_PROTO_TCP } = require('../lib/npcap-parse.cjs');
const { parseForeignAddr } = require('../telemetry-core.cjs');

function buildEthernetIpv4Udp({ srcIp, dstIp, sport, dport, payloadLen = 20 }) {
  const eth = Buffer.alloc(14 + 20 + 8 + payloadLen);
  // Dest/src MAC zeros; ethertype IPv4
  eth.writeUInt16BE(0x0800, 12);

  const ipOff = 14;
  eth[ipOff] = 0x45; // v4, ihl=5
  eth.writeUInt16BE(20 + 8 + payloadLen, ipOff + 2); // total length
  eth[ipOff + 9] = IP_PROTO_UDP;
  const sip = srcIp.split('.').map(Number);
  const dip = dstIp.split('.').map(Number);
  for (let i = 0; i < 4; i++) eth[ipOff + 12 + i] = sip[i];
  for (let i = 0; i < 4; i++) eth[ipOff + 16 + i] = dip[i];

  const udpOff = ipOff + 20;
  eth.writeUInt16BE(sport, udpOff);
  eth.writeUInt16BE(dport, udpOff + 2);
  eth.writeUInt16BE(8 + payloadLen, udpOff + 4);
  return eth;
}

function buildEthernetIpv4Tcp({ srcIp, dstIp, sport, dport }) {
  const eth = Buffer.alloc(14 + 20 + 20);
  eth.writeUInt16BE(0x0800, 12);
  const ipOff = 14;
  eth[ipOff] = 0x45;
  eth.writeUInt16BE(40, ipOff + 2);
  eth[ipOff + 9] = IP_PROTO_TCP;
  const sip = srcIp.split('.').map(Number);
  const dip = dstIp.split('.').map(Number);
  for (let i = 0; i < 4; i++) eth[ipOff + 12 + i] = sip[i];
  for (let i = 0; i < 4; i++) eth[ipOff + 16 + i] = dip[i];
  const tcpOff = ipOff + 20;
  eth.writeUInt16BE(sport, tcpOff);
  eth.writeUInt16BE(dport, tcpOff + 2);
  return eth;
}

describe('npcap UDP/TCP parse', () => {
  it('tags outbound UDP with remote port', () => {
    const calls = [];
    const { handleFrame } = createFrameHandler({
      getLocalIpSet: () => new Set(['10.0.0.2']),
      addStat: (ip, dir, len, meta) => calls.push({ ip, dir, len, meta }),
      getDatalink: () => DLT_EN10MB,
    });
    const frame = buildEthernetIpv4Udp({
      srcIp: '10.0.0.2',
      dstIp: '8.8.8.8',
      sport: 54321,
      dport: 53,
    });
    handleFrame(frame, frame.length);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].ip, '8.8.8.8');
    assert.equal(calls[0].dir, 'out');
    assert.equal(calls[0].meta.protocol, 'UDP');
    assert.equal(calls[0].meta.port, 53);
  });

  it('tags inbound TCP with remote port', () => {
    const calls = [];
    const { handleFrame } = createFrameHandler({
      getLocalIpSet: () => new Set(['10.0.0.2']),
      addStat: (ip, dir, len, meta) => calls.push({ ip, dir, len, meta }),
      getDatalink: () => DLT_EN10MB,
    });
    const frame = buildEthernetIpv4Tcp({
      srcIp: '1.2.3.4',
      dstIp: '10.0.0.2',
      sport: 443,
      dport: 51234,
    });
    handleFrame(frame, frame.length);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].ip, '1.2.3.4');
    assert.equal(calls[0].dir, 'in');
    assert.equal(calls[0].meta.protocol, 'TCP');
    assert.equal(calls[0].meta.port, 443);
  });
});

describe('parseForeignAddr', () => {
  it('accepts IPv4 foreign endpoints and rejects wildcards', () => {
    assert.deepEqual(parseForeignAddr('8.8.8.8:53'), { ip: '8.8.8.8', port: 53 });
    assert.equal(parseForeignAddr('*:*'), null);
    assert.equal(parseForeignAddr('[::1]:53'), null);
    assert.equal(parseForeignAddr('127.0.0.1:53'), null);
  });
});
