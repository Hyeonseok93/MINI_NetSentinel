import { normalizeIpv4 } from '../../utils/ip';
import { DEFAULT_TRUSTED_IPS } from './constants';
import { formatClock } from './time';
import type { IpSession } from '../../types/network';
import {
  applySessionMembershipToRow,
  type MembershipSets,
} from './sessionMembership';

export type TrustStoreDeps = {
  sessions: Map<string, IpSession>;
  blockedIps: Set<string>;
  notify: () => void;
};

/** Trusted / verified-normal membership CRUD. */
export class TrustStore {
  trustedIps: Set<string> = new Set(DEFAULT_TRUSTED_IPS);
  builtInTrustedIps: Set<string> = new Set(DEFAULT_TRUSTED_IPS);
  confirmedNormalIps: Set<string> = new Set();
  verifiedDomains: Map<string, string> = new Map();
  trustedDomains: Map<string, string> = new Map();

  membershipSets(blockedIps: Set<string>): MembershipSets {
    return {
      trustedIps: this.trustedIps,
      confirmedNormalIps: this.confirmedNormalIps,
      blockedIps,
    };
  }

  applyToSession(
    ip: string,
    deps: TrustStoreDeps,
    hints?: { isTrafficSpike?: boolean }
  ) {
    const sess = deps.sessions.get(ip);
    if (!sess) return;
    applySessionMembershipToRow(sess, this.membershipSets(deps.blockedIps), hints);
  }

  removeTrustedIp(ip: string, deps: TrustStoreDeps) {
    this.trustedIps.delete(ip);
    this.trustedDomains.delete(ip);
    this.applyToSession(ip, deps);
    deps.notify();
  }

  addTrustedIp(ip: string, domain: string | undefined, deps: TrustStoreDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    this.trustedIps.add(safeIp);
    if (domain) this.trustedDomains.set(safeIp, domain);
    const sess = deps.sessions.get(safeIp);
    if (sess && domain) sess.domain = domain;
    this.applyToSession(safeIp, deps);
    deps.notify();
  }

  addVerifiedNormalIp(ip: string, domain: string | undefined, deps: TrustStoreDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    this.confirmedNormalIps.add(safeIp);
    if (domain) this.verifiedDomains.set(safeIp, domain);
    this.trustedIps.delete(safeIp);
    this.trustedDomains.delete(safeIp);
    const sess = deps.sessions.get(safeIp);
    if (sess && domain) sess.domain = domain;
    this.applyToSession(safeIp, deps);
    deps.notify();
  }

  resetNormalStatus(ip: string, deps: TrustStoreDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    this.confirmedNormalIps.delete(safeIp);
    this.verifiedDomains.delete(safeIp);
    this.applyToSession(safeIp, deps);
    deps.notify();
  }

  clearTrustedList(deps: TrustStoreDeps) {
    const keep = new Set(this.builtInTrustedIps);
    const silent: TrustStoreDeps = { ...deps, notify: () => {} };
    Array.from(this.trustedIps).forEach((ip) => {
      if (!keep.has(ip)) this.removeTrustedIp(ip, silent);
    });
    deps.notify();
  }

  clearVerifiedList(deps: TrustStoreDeps) {
    const silent: TrustStoreDeps = { ...deps, notify: () => {} };
    Array.from(this.confirmedNormalIps).forEach((ip) => {
      this.resetNormalStatus(ip, silent);
    });
    this.verifiedDomains.clear();
    deps.notify();
  }

  toggleBaseline(ip: string, deps: TrustStoreDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return;
    if (this.trustedIps.has(safeIp)) {
      this.trustedIps.delete(safeIp);
      this.trustedDomains.delete(safeIp);
    } else {
      this.trustedIps.add(safeIp);
      const sess = deps.sessions.get(safeIp);
      if (sess?.domain) this.trustedDomains.set(safeIp, sess.domain);
    }
    this.applyToSession(safeIp, deps);
    deps.notify();
  }

  resetToBuiltIns(deps: TrustStoreDeps) {
    this.confirmedNormalIps.clear();
    this.verifiedDomains.clear();
    this.trustedIps = new Set(this.builtInTrustedIps);
    this.trustedDomains.clear();
    deps.sessions.forEach((sess, ip) => {
      if (this.trustedIps.has(ip)) {
        sess.isBaseline = true;
        sess.status = 'normal';
      } else {
        sess.isBaseline = false;
        sess.status = 'new';
      }
    });
  }

  getTrustedList(deps: TrustStoreDeps) {
    const trusted: { ip: string; domain?: string; addedAt: string; note?: string }[] = [];
    this.trustedIps.forEach((ip) => {
      if (deps.blockedIps.has(ip)) return;
      const sess = deps.sessions.get(ip);
      trusted.push({
        ip,
        domain: sess?.domain || this.trustedDomains.get(ip),
        addedAt: sess?.lastSeen || formatClock(new Date(), false),
        note: this.builtInTrustedIps.has(ip) ? 'Built-in default' : undefined,
      });
    });
    return trusted;
  }

  getConfirmedNormalList(deps: TrustStoreDeps) {
    const list: { ip: string; domain?: string; country: string; lastSeen: string }[] = [];
    this.confirmedNormalIps.forEach((ip) => {
      if (this.trustedIps.has(ip)) return;
      if (deps.blockedIps.has(ip)) return;
      const sess = deps.sessions.get(ip);
      list.push({
        ip,
        domain: sess?.domain || this.verifiedDomains.get(ip),
        country: sess?.country || '—',
        lastSeen: sess?.lastSeen || '—',
      });
    });
    return list;
  }
}
