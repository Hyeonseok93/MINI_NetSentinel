const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isValidIpv4, assertIpv4, normalizeIpv4 } = require('../../shared/ipv4.cjs');

describe('shared/ipv4', () => {
  it('accepts normal IPv4', () => {
    assert.equal(isValidIpv4('1.2.3.4'), true);
    assert.equal(isValidIpv4('255.255.255.255'), true);
    assert.equal(isValidIpv4('0.0.0.0'), true);
    assert.equal(normalizeIpv4(' 10.0.0.1 '), '10.0.0.1');
  });

  it('rejects garbage', () => {
    assert.equal(isValidIpv4('not-an-ip'), false);
    assert.equal(isValidIpv4('1.2.3'), false);
    assert.equal(isValidIpv4('1.2.3.256'), false);
    assert.equal(isValidIpv4('01.02.03.04'), true); // numeric octets still valid
    assert.equal(isValidIpv4('2001:db8::1'), false);
    assert.equal(normalizeIpv4('999.1.1.1'), null);
    assert.equal(normalizeIpv4(''), null);
    assert.throws(() => assertIpv4('nope'), /Invalid IPv4/);
  });
});
