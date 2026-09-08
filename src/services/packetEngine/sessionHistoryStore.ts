import type { IpSession } from '../../types/network';

type PacketDeltas = {
  pIn: number;
  pOut: number;
  tPackets: number;
  bIn: number;
  bOut: number;
  tBytes: number;
};

/** Cumulative IP sessions for this run (survives live reconcile eviction). */
export class SessionHistoryStore {
  cumulative = new Map<string, IpSession>();

  upsert(session: IpSession, deltas: PacketDeltas) {
    const existing = this.cumulative.get(session.ip);
    if (!existing) {
      this.cumulative.set(session.ip, { ...session });
      return;
    }
    existing.packetsIn += deltas.pIn;
    existing.packetsOut += deltas.pOut;
    existing.totalPackets += deltas.tPackets;
    existing.bytesIn += deltas.bIn;
    existing.bytesOut += deltas.bOut;
    existing.totalBytes += deltas.tBytes;
    existing.lastSeen = session.lastSeen;
    existing.domain = session.domain;
    existing.country = session.country;
    existing.countryCode = session.countryCode;
    existing.status = session.status;
    existing.protocol = session.protocol;
    existing.port = session.port;
    existing.isBaseline = session.isBaseline;
  }

  list(): IpSession[] {
    return Array.from(this.cumulative.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }

  clear() {
    this.cumulative.clear();
  }
}
