const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeReason,
  RULE_PREFIX_OUT,
  RULE_PREFIX_IN,
  assertIpv4,
} = require('../firewall-windows.cjs');

describe('firewall rule helpers', () => {
  it('builds stable NetSentinel rule name prefixes', () => {
    assert.equal(RULE_PREFIX_OUT, 'NetSentinel Block OUT ');
    assert.equal(RULE_PREFIX_IN, 'NetSentinel Block IN ');
    assert.ok(`${RULE_PREFIX_OUT}1.2.3.4`.startsWith('NetSentinel Block OUT '));
  });

  it('sanitizes firewall description metacharacters', () => {
    assert.equal(sanitizeReason('ok reason'), 'ok reason');
    assert.match(sanitizeReason('evil & | ; ` $(rm)'), /^[\w\s.\-:/()#,]*$/);
    assert.equal(sanitizeReason(''), 'NetSentinel block');
    assert.ok(sanitizeReason('x'.repeat(500)).length <= 120);
  });

  it('assertIpv4 rejects garbage', () => {
    assert.throws(() => assertIpv4('nope'), /Invalid IPv4/);
    assert.equal(assertIpv4(' 8.8.8.8 '), '8.8.8.8');
  });
});
