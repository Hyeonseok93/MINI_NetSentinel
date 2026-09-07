const { assertIpv4 } = require('./lib/ipv4.cjs');
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

function ruleNameOut(ip) {
  return `NetSentinel Block OUT ${ip}`;
}
function ruleNameIn(ip) {
  return `NetSentinel Block IN ${ip}`;
}

/** Keep netsh description free of shell/control metacharacters (execFile still benefits). */
function sanitizeReason(reason) {
  const raw = String(reason || 'NetSentinel block').slice(0, 120);
  return raw.replace(/[^\w\s.\-:/()#,]/g, '').trim() || 'NetSentinel block';
}

async function runNetsh(args) {
  return execFileAsync('netsh', args, {
    timeout: 8000,
    windowsHide: true,
    encoding: 'utf8',
  });
}

async function firewallBlockIp(ip, reason = 'NetSentinel block') {
  const safeIp = assertIpv4(ip);
  const safeReason = sanitizeReason(reason);
  const outName = ruleNameOut(safeIp);
  const inName = ruleNameIn(safeIp);

  // Remove existing first to keep idempotent
  await firewallUnblockIp(safeIp).catch(() => {});

  try {
    await runNetsh([
      'advfirewall',
      'firewall',
      'add',
      'rule',
      `name=${outName}`,
      'dir=out',
      'action=block',
      `remoteip=${safeIp}`,
      'enable=yes',
      `description=${safeReason}`,
    ]);
    await runNetsh([
      'advfirewall',
      'firewall',
      'add',
      'rule',
      `name=${inName}`,
      'dir=in',
      'action=block',
      `remoteip=${safeIp}`,
      'enable=yes',
      `description=${safeReason}`,
    ]);
    return { ok: true, ip: safeIp, elevated: true };
  } catch (err) {
    const msg = err?.message || String(err);
    const needsAdmin = /access is denied|requir(e|es) elevation|거부|관리자/i.test(msg);
    return {
      ok: false,
      ip: safeIp,
      elevated: !needsAdmin,
      error: needsAdmin
        ? 'Administrator privileges required to modify Windows Firewall'
        : msg,
    };
  }
}

async function firewallUnblockIp(ip) {
  const safeIp = assertIpv4(ip);
  const errors = [];

  for (const name of [ruleNameOut(safeIp), ruleNameIn(safeIp)]) {
    try {
      await runNetsh(['advfirewall', 'firewall', 'delete', 'rule', `name=${name}`]);
    } catch (err) {
      // delete returns error if rule missing — ignore benign cases
      const msg = err?.message || String(err);
      if (!/cannot find|no rules|지정|없습니다/i.test(msg)) {
        errors.push(msg);
      }
    }
  }

  if (errors.length) {
    const needsAdmin = errors.some((m) => /access is denied|elevation|거부|관리자/i.test(m));
    return {
      ok: false,
      ip: safeIp,
      error: needsAdmin
        ? 'Administrator privileges required to modify Windows Firewall'
        : errors.join(' | '),
    };
  }

  return { ok: true, ip: safeIp };
}

module.exports = {
  firewallBlockIp,
  firewallUnblockIp,
  assertIpv4,
  sanitizeReason,
};
