import famousIpsJson from '../../../shared/famous-ips.json';

type FamousIpsFile = {
  defaultTrustedIps: string[];
};

const famousIps = famousIpsJson as FamousIpsFile;

/**
 * Built-in trusted defaults — sourced from shared/famous-ips.json.
 * Domain map lives only in scripts (telemetry) via famous-ips.cjs.
 */
export const MAX_ANOMALY_EVENTS = 500;
export const MAX_TRAFFIC_HISTORY_UI = 3600;
export const MAX_SEEN_IPS = 5000;

export const DEFAULT_TRUSTED_IPS = famousIps.defaultTrustedIps as readonly string[];
