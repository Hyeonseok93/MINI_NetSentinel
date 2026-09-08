import type { IpSession } from '../../types/network';

export type MembershipSets = {
  trustedIps: Set<string>;
  confirmedNormalIps: Set<string>;
  blockedIps: Set<string>;
};

export type MembershipHints = {
  /** Traffic spike this tick (pkts/s over threshold) — UI "suspicious" means spike, not malware. */
  isTrafficSpike?: boolean;
};

/**
 * Single source of truth for session row status + baseline flag.
 * Used on every ingest tick and on trust/block/verify mutations.
 */
export function resolveSessionMembership(
  ip: string,
  sets: MembershipSets,
  hints: MembershipHints = {}
): { status: IpSession['status']; isBaseline: boolean } {
  const isBlocked = sets.blockedIps.has(ip);
  const isBaseline = sets.trustedIps.has(ip);
  const isConfirmedNormal = sets.confirmedNormalIps.has(ip);

  if (isBlocked) {
    return { status: 'blocked', isBaseline };
  }
  if (isBaseline || isConfirmedNormal) {
    return { status: 'normal', isBaseline };
  }
  if (hints.isTrafficSpike) {
    return { status: 'suspicious', isBaseline: false };
  }
  return { status: 'new', isBaseline: false };
}

/** Apply membership resolution onto an existing session row (mutations / refresh). */
export function applySessionMembershipToRow(
  sess: IpSession,
  sets: MembershipSets,
  hints: MembershipHints = {}
): void {
  const next = resolveSessionMembership(sess.ip, sets, hints);
  sess.status = next.status;
  sess.isBaseline = next.isBaseline;
}
