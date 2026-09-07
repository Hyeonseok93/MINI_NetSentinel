import type { BlacklistedIpItem, IpSession } from '../../types/network';
import { normalizeIpv4 } from '../../utils/ip';
import { getElectronIpcOrWarn, isElectronShell } from '../../utils/electronIpc';

type ConnectionStatus = {
  mode: 'electron' | 'vite-dev' | 'offline';
  ok: boolean;
  lastError: string | null;
  lastSuccessAt: string | null;
  captureMode: 'npcap' | 'netstat' | 'unknown';
};

export type FirewallDeps = {
  sessions: Map<string, IpSession>;
  connectionStatus: ConnectionStatus;
  applySessionMembership: (ip: string) => void;
  notify: () => void;
  setConnectionStatus: (next: ConnectionStatus) => void;
};

/** Local blocked-IP set + Windows firewall IPC. */
export class FirewallStore {
  blockedIps = new Set<string>();
  blockedIpReasons = new Map<string, string>();
  blockedIpAt = new Map<string, number>();

  list(): BlacklistedIpItem[] {
    const list: BlacklistedIpItem[] = [];
    this.blockedIps.forEach((ip) => {
      list.push({
        ip,
        reason: this.blockedIpReasons.get(ip) || 'Blocked by Firewall Policy',
        blockedAt: this.blockedIpAt.get(ip) || Date.now(),
      });
    });
    return list;
  }

  clearLocal() {
    this.blockedIps.clear();
    this.blockedIpReasons.clear();
    this.blockedIpAt.clear();
  }

  async blockIp(ip: string, reason: string, deps: FirewallDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) {
      deps.setConnectionStatus({
        ...deps.connectionStatus,
        lastError: `Invalid IPv4 address: ${ip}`,
      });
      deps.notify();
      return { ok: false, error: `Invalid IPv4 address: ${ip}` };
    }
    const safeReason = String(reason || 'Manual Security Block').slice(0, 120);

    const applyLocalBlock = () => {
      this.blockedIps.add(safeIp);
      this.blockedIpReasons.set(safeIp, safeReason);
      if (!this.blockedIpAt.has(safeIp)) {
        this.blockedIpAt.set(safeIp, Date.now());
      }
      const sess = deps.sessions.get(safeIp);
      if (sess) sess.status = 'blocked';
    };

    const rollbackLocalBlock = () => {
      this.blockedIps.delete(safeIp);
      this.blockedIpReasons.delete(safeIp);
      this.blockedIpAt.delete(safeIp);
      deps.applySessionMembership(safeIp);
    };

    applyLocalBlock();
    deps.notify();

    const ipc = getElectronIpcOrWarn('Firewall');
    if (ipc) {
      try {
        const result = await ipc.invoke('firewall-block-ip', safeIp, safeReason);
        if (result && result.ok === false) {
          rollbackLocalBlock();
          deps.setConnectionStatus({
            ...deps.connectionStatus,
            lastError: result.error || 'Firewall block failed',
          });
          deps.notify();
        }
        return result;
      } catch (err: any) {
        rollbackLocalBlock();
        deps.setConnectionStatus({
          ...deps.connectionStatus,
          lastError: err?.message || 'Firewall block IPC failed',
        });
        deps.notify();
        return { ok: false, error: err?.message || String(err) };
      }
    }

    // Electron shell without bridge: do not leave a fake "blocked" UI state.
    if (isElectronShell() || deps.connectionStatus.mode === 'electron') {
      rollbackLocalBlock();
      deps.setConnectionStatus({
        ...deps.connectionStatus,
        lastError: 'Firewall IPC unavailable',
      });
      deps.notify();
      return { ok: false, error: 'Firewall IPC unavailable' };
    }
    return { ok: false, error: 'Firewall IPC unavailable (UI-only block applied)' };
  }

  async unblockIp(ip: string, deps: FirewallDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) {
      return { ok: false, error: `Invalid IPv4 address: ${ip}` };
    }
    this.blockedIps.delete(safeIp);
    this.blockedIpReasons.delete(safeIp);
    this.blockedIpAt.delete(safeIp);
    deps.applySessionMembership(safeIp);
    deps.notify();

    const ipc = getElectronIpcOrWarn('Firewall');
    if (ipc) {
      try {
        return await ipc.invoke('firewall-unblock-ip', safeIp);
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    }
    return { ok: false, error: 'Firewall IPC unavailable (UI-only unblock applied)' };
  }

  async toggleBlockIp(ip: string, deps: FirewallDeps) {
    const safeIp = normalizeIpv4(ip);
    if (!safeIp) return { ok: false, error: `Invalid IPv4 address: ${ip}` };
    if (this.blockedIps.has(safeIp)) {
      return this.unblockIp(safeIp, deps);
    }
    return this.blockIp(safeIp, 'User Blocked', deps);
  }

  async clearAll(deps: FirewallDeps) {
    const blocked = Array.from(this.blockedIps);
    for (const ip of blocked) {
      try {
        await this.unblockIp(ip, deps);
      } catch {
        /* continue */
      }
    }
    deps.notify();
  }
}
