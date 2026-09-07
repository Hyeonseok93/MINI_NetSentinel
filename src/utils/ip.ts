/**
 * Shared IPv4 helper for the renderer — single implementation: shared/ipv4.cjs
 * (isValidIpv4 / assertIpv4 stay Node-side via scripts/lib/ipv4.cjs)
 */
import ipv4 from '../../shared/ipv4.cjs';

type Ipv4Api = {
  normalizeIpv4: (ip: string) => string | null;
};

const api = ipv4 as Ipv4Api;

export const normalizeIpv4 = api.normalizeIpv4;
