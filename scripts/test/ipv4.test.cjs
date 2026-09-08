const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isValidIpv4, assertIpv4, normalizeIpv4 } = require('../../shared/ipv4.cjs');

describe('shared/ipv4', () => {
  it('accepts normal IPv4', () => {
    assert.equal(isValidIpv4('1.2.3.4'), true);
    assert.equal(isValidIpv4('255.255.255.255'), true);
    assert.equal(normalizeIpv4(' 10.0.0.1 '), '10.0.0.1');
  });

  it('rejects garbage', () => {
    assert.equal(isValidIpv4('not-an-ip'), false);
    assert.equal(isValidIpv4('1.2.3'), false);
    assert.equal(isValidIpv4('1.2.3.256'), false);
    assert.equal(normalizeIpv4('999.1.1.1'), null);
    assert.throws(() => assertIpv4('nope'), /Invalid IPv4/);
  });
});
