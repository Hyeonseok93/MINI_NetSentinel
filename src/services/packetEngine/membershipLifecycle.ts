import { getElectronIpc } from '../../utils/electronIpc';
import { normalizeIpv4 } from '../../utils/ip';
import type { FirewallStore } from './firewallStore';
import type { TrustStore } from './trustStore';
import {
  loadPersistedMembership,
  savePersistedMembership,
  type PersistedBlocked,
  type PersistedTrusted,
} from './membershipPersistence';

export type MembershipLifecycleDeps = {
  trust: TrustStore;
  firewall: FirewallStore;
  notify: () => void;
  setHydrated: (v: boolean) => void;
  isHydrated: () => boolean;
};

/** Load trusted/verified/blocked from user store into live stores. */
export async function bootstrapMembership(deps: MembershipLifecycleDeps) {
  try {
    const data = await loadPersistedMembership();
    for (const entry of data.trusted) {
      if (deps.trust.builtInTrustedIps.has(entry.ip)) continue;
      deps.trust.trustedIps.add(entry.ip);
      if (entry.domain) deps.trust.trustedDomains.set(entry.ip, entry.domain);
    }
    for (const entry of data.verified) {
      deps.trust.confirmedNormalIps.add(entry.ip);
      if (entry.domain) deps.trust.verifiedDomains.set(entry.ip, entry.domain);
    }
    for (const entry of data.blocked) {
      deps.firewall.blockedIps.add(entry.ip);
      deps.firewall.blockedIpReasons.set(entry.ip, entry.reason);
      deps.firewall.blockedIpAt.set(entry.ip, entry.blockedAt);
    }
  } catch {
    /* start empty on load failure */
  }
  deps.setHydrated(true);
  deps.notify();
  await syncFirewallFromOs(deps);
}

export function persistMembership(deps: MembershipLifecycleDeps) {
  if (!deps.isHydrated()) return;
  const trusted: PersistedTrusted[] = [];
  deps.trust.trustedIps.forEach((ip) => {
    if (deps.trust.builtInTrustedIps.has(ip)) return;
    const domain = deps.trust.trustedDomains.get(ip);
    trusted.push(domain ? { ip, domain } : { ip });
  });
  const verified: PersistedTrusted[] = [];
  deps.trust.confirmedNormalIps.forEach((ip) => {
    const domain = deps.trust.verifiedDomains.get(ip);
    verified.push(domain ? { ip, domain } : { ip });
  });
  const blocked: PersistedBlocked[] = deps.firewall.list().map((item) => ({
    ip: item.ip,
    reason: item.reason,
    blockedAt: item.blockedAt,
  }));
  void savePersistedMembership({ version: 1, trusted, verified, blocked });
}

/** Merge NetSentinel Windows Firewall rules into UI; re-apply local-only blocks. */
export async function syncFirewallFromOs(deps: MembershipLifecycleDeps) {
  const ipc = getElectronIpc();
  if (!ipc) return;
  try {
    const result = (await ipc.invoke('firewall-list-blocked')) as {
      ok?: boolean;
      ips?: Array<{ ip: string; reason?: string }>;
    };
    if (!result?.ok || !Array.isArray(result.ips)) return;

    const osIps = new Set<string>();
    let changed = false;
    for (const item of result.ips) {
      const ip = normalizeIpv4(item.ip);
      if (!ip) continue;
      osIps.add(ip);
      if (!deps.firewall.blockedIps.has(ip)) {
        deps.firewall.blockedIps.add(ip);
        deps.firewall.blockedIpReasons.set(
          ip,
          String(item.reason || 'Windows Firewall (NetSentinel)').slice(0, 120)
        );
        deps.firewall.blockedIpAt.set(ip, Date.now());
        changed = true;
      }
    }

    for (const ip of Array.from(deps.firewall.blockedIps)) {
      if (osIps.has(ip)) continue;
      const reason = deps.firewall.blockedIpReasons.get(ip) || 'Restored NetSentinel block';
      try {
        await ipc.invoke('firewall-block-ip', ip, reason);
      } catch {
        /* best-effort restore */
      }
    }

    persistMembership(deps);
    if (changed) deps.notify();
  } catch {
    /* ignore list/sync failures (non-admin / IPC) */
  }
}
