/**
 * Shared IPv4 validation — single source for Node scripts and the Vite renderer.
 * Renderer imports this via src/utils/ip.ts (Vite bundles CJS).
 */
function isValidIpv4(ip) {
  if (typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return false;
  const parts = trimmed.split('.').map((n) => Number(n));
  return parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
}

function assertIpv4(ip) {
  const trimmed = String(ip || '').trim();
  if (!isValidIpv4(trimmed)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return trimmed;
}

function normalizeIpv4(ip) {
  const trimmed = String(ip || '').trim();
  return isValidIpv4(trimmed) ? trimmed : null;
}

module.exports = { isValidIpv4, assertIpv4, normalizeIpv4 };
