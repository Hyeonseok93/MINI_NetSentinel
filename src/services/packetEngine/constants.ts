import famousIpsJson from '../../../shared/famous-ips.json';

export {
  MAX_ANOMALY_EVENTS,
  MAX_TRAFFIC_HISTORY_UI,
  MAX_SEEN_IPS,
  MIN_HISTORY_SPIKE_PACKETS_PER_SEC,
  MIN_REFRESH_INTERVAL_MS,
  MAX_REFRESH_INTERVAL_MS,
  DEFAULT_REFRESH_INTERVAL_MS,
} from './limits';

type FamousIpsFile = {
  defaultTrustedIps: string[];
};

const famousIps = famousIpsJson as FamousIpsFile;

/**
 * Built-in trusted defaults — sourced from shared/famous-ips.json.
 * Domain map lives only in scripts (telemetry) via famous-ips.cjs.
 */
export const DEFAULT_TRUSTED_IPS = famousIps.defaultTrustedIps as readonly string[];
