/**
 * Shared IPv4 validation for UI + engine (matches firewall-windows assertIpv4).
 */
function isValidIpv4(ip: string): boolean {
  if (typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return false;
  const parts = trimmed.split('.').map((n) => Number(n));
  return parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
}

export function normalizeIpv4(ip: string): string | null {
  const trimmed = String(ip || '').trim();
  return isValidIpv4(trimmed) ? trimmed : null;
}
