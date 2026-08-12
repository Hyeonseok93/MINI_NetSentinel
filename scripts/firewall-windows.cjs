const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

function ruleNameOut(ip) {
  return `NetSentinel Block OUT ${ip}`;
}
function ruleNameIn(ip) {
  return `NetSentinel Block IN ${ip}`;
}

function assertIpv4(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.some((n) => n < 0 || n > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return ip;
}

async function firewallBlockIp(ip, reason = 'NetSentinel block') {
  const safeIp = assertIpv4(ip);
  const outName = ruleNameOut(safeIp);
  const inName = ruleNameIn(safeIp);

  // Remove existing first to keep idempotent
  await firewallUnblockIp(safeIp).catch(() => {});

  try {
    await execAsync(
      `netsh advfirewall firewall add rule name="${outName}" dir=out action=block remoteip=${safeIp} enable=yes description="${reason.replace(/"/g, '')}"`,
      { timeout: 8000, windowsHide: true }
    );
    await execAsync(
      `netsh advfirewall firewall add rule name="${inName}" dir=in action=block remoteip=${safeIp} enable=yes description="${reason.replace(/"/g, '')}"`,
      { timeout: 8000, windowsHide: true }
    );
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
      await execAsync(`netsh advfirewall firewall delete rule name="${name}"`, {
        timeout: 8000,
        windowsHide: true,
      });
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
};
