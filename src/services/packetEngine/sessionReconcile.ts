import type { IpSession } from '../../types/network';

/** Keep sessions map aligned with remotes seen on a successful telemetry tick. */
export function reconcileActiveSessions(sessions: Map<string, IpSession>, liveIps: Set<string>) {
  for (const ip of [...sessions.keys()]) {
    if (!liveIps.has(ip)) sessions.delete(ip);
  }
}
