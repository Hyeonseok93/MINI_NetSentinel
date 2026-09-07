import type { GeoNode, IpSession } from '../../types/network';
import { getElectronIpcOrWarn } from '../../utils/electronIpc';

export class GeoStore {
  myPublicGeo = { country: 'South Korea', countryCode: 'KR' };
  cumulativeGeoMap = new Map<string, GeoNode>();
  cumulativeCountrySessionsMap = new Map<string, Map<string, IpSession>>();

  async detectMyPublicGeo(onUpdated?: () => void) {
    try {
      const ipc = getElectronIpcOrWarn('GeoIP');
      if (ipc) {
        const geo = await ipc.invoke('my-public-geo');
        if (geo?.country) {
          this.myPublicGeo = {
            country: geo.country,
            countryCode: geo.countryCode || geo.country_code || 'NET',
          };
          onUpdated?.();
          return;
        }
      }
    } catch (err) {
      console.warn('[packet-engine] my-public-geo IPC failed:', err);
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Seoul') || tz.includes('Korea')) {
      this.myPublicGeo = { country: 'South Korea', countryCode: 'KR' };
    }
  }

  upsertCountrySession(session: IpSession, packetDeltas: {
    pIn: number;
    pOut: number;
    tPackets: number;
    bIn: number;
    bOut: number;
    tBytes: number;
  }) {
    const countryKey = session.country || 'Unknown Location';
    if (!this.cumulativeCountrySessionsMap.has(countryKey)) {
      this.cumulativeCountrySessionsMap.set(countryKey, new Map());
    }
    const countrySessionMap = this.cumulativeCountrySessionsMap.get(countryKey)!;
    if (!countrySessionMap.has(session.ip)) {
      countrySessionMap.set(session.ip, { ...session });
    } else {
      const existingSess = countrySessionMap.get(session.ip)!;
      existingSess.packetsIn += packetDeltas.pIn;
      existingSess.packetsOut += packetDeltas.pOut;
      existingSess.totalPackets += packetDeltas.tPackets;
      existingSess.bytesIn += packetDeltas.bIn;
      existingSess.bytesOut += packetDeltas.bOut;
      existingSess.totalBytes += packetDeltas.tBytes;
      existingSess.lastSeen = session.lastSeen;
      existingSess.country = session.country;
      existingSess.countryCode = session.countryCode;
      existingSess.status = session.status;
    }
  }

  /** Live geo from current sessions; also refreshes cumulative highs. */
  getLiveGeoNodes(sessions: Iterable<IpSession>): GeoNode[] {
    const geoMap = new Map<string, { count: number; bytes: number; code: string }>();
    for (const sess of sessions) {
      const c = sess.country || 'Unknown Location';
      const code = sess.countryCode || (c === 'South Korea' ? 'KR' : c === 'United States' ? 'US' : 'NET');
      const existing = geoMap.get(c) || { count: 0, bytes: 0, code };
      existing.count += 1;
      existing.bytes += sess.totalBytes;
      if (code && code !== 'NET') existing.code = code;
      geoMap.set(c, existing);
    }

    const result: GeoNode[] = [];
    geoMap.forEach((val, country) => {
      const nodeItem: GeoNode = {
        country,
        countryCode: val.code || 'NET',
        activeIpCount: val.count,
        totalBytes: val.bytes,
      };
      result.push(nodeItem);

      if (!this.cumulativeGeoMap.has(country)) {
        this.cumulativeGeoMap.set(country, { ...nodeItem });
      } else {
        const cNode = this.cumulativeGeoMap.get(country)!;
        cNode.activeIpCount = Math.max(cNode.activeIpCount, val.count);
        cNode.totalBytes = Math.max(cNode.totalBytes, val.bytes);
        if (val.code && val.code !== 'NET') cNode.countryCode = val.code;
      }
    });

    return result.filter((n) => n.activeIpCount > 0).sort((a, b) => b.activeIpCount - a.activeIpCount);
  }

  getCumulativeGeoNodes(): GeoNode[] {
    return Array.from(this.cumulativeGeoMap.values()).sort((a, b) => b.activeIpCount - a.activeIpCount);
  }

  getCumulativeGeoSessions(country: string): IpSession[] {
    const map = this.cumulativeCountrySessionsMap.get(country);
    if (!map) return [];
    return Array.from(map.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }

  clearCumulative() {
    this.cumulativeGeoMap.clear();
    this.cumulativeCountrySessionsMap.clear();
  }
}
