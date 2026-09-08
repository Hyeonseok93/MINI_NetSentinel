const { assertIpv4, isValidIpv4 } = require('./lib/ipv4.cjs');
const { execFile } = require('child_process');
const util = require('util');

const execFileAsync = util.promisify(execFile);

const RULE_PREFIX_OUT = 'NetSentinel Block OUT ';
const RULE_PREFIX_IN = 'NetSentinel Block IN ';

function ruleNameOut(ip) {
  return `${RULE_PREFIX_OUT}${ip}`;
}
function ruleNameIn(ip) {
  return `${RULE_PREFIX_IN}${ip}`;
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

/**
 * List IPs currently blocked by NetSentinel-named Windows Firewall rules.
 * Best-effort parse of `netsh advfirewall firewall show rule name=all`.
 */
async function firewallListBlockedIps() {
  try {
    const { stdout } = await runNetsh([
      'advfirewall',
      'firewall',
      'show',
      'rule',
      'name=all',
    ]);
    const text = String(stdout || '');
    const byIp = new Map();
    let currentName = '';
    let currentDesc = '';

    const flush = () => {
      if (!currentName.startsWith(RULE_PREFIX_OUT)) return;
      const ip = currentName.slice(RULE_PREFIX_OUT.length).trim();
      if (!isValidIpv4(ip)) return;
      if (!byIp.has(ip)) {
        byIp.set(ip, {
          ip,
          reason: currentDesc || 'Windows Firewall (NetSentinel)',
        });
      }
    };

    for (const line of text.split(/\r?\n/)) {
      const nameMatch = line.match(/^\s*Rule Name:\s*(.+)\s*$/i);
      if (nameMatch) {
        flush();
        currentName = nameMatch[1].trim();
        currentDesc = '';
        continue;
      }
      const descMatch = line.match(/^\s*Description:\s*(.*)\s*$/i);
      if (descMatch) {
        currentDesc = String(descMatch[1] || '').trim();
      }
    }
    flush();

    return { ok: true, ips: Array.from(byIp.values()) };
  } catch (err) {
    return {
      ok: false,
      ips: [],
      error: err?.message || String(err),
    };
  }
}

module.exports = {
  firewallBlockIp,
  firewallUnblockIp,
  firewallListBlockedIps,
  assertIpv4,
  sanitizeReason,
  RULE_PREFIX_OUT,
  RULE_PREFIX_IN,
};
