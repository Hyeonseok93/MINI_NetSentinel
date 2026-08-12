import { IpSession, ProcessTrafficPoint, GeoNode, GroupedProcess } from '../../types/network';
import { groupProcessesByName } from '../../utils/groupProcesses';
import { SortOptionKey, AppSortOptionKey, GeoSortOptionKey, SessionFilterType } from './hubTypes';

export function filterAndSortSessions(
  sessions: IpSession[],
  searchTerm: string,
  filterType: SessionFilterType,
  sortOption: SortOptionKey
): IpSession[] {
  return sessions
    .filter((s) => {
      const matchSearch =
        s.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.domain && s.domain.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.country.toLowerCase().includes(searchTerm.toLowerCase());

      const matchType =
        filterType === 'all'
          ? true
          : filterType === 'baseline'
          ? s.isBaseline
          : filterType === 'normal'
          ? s.status === 'normal' && !s.isBaseline
          : s.status === filterType;

      return matchSearch && matchType;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'packets-desc':
          return b.totalPackets - a.totalPackets;
        case 'packets-asc':
          return a.totalPackets - b.totalPackets;
        case 'bytes-desc':
          return b.totalBytes - a.totalBytes;
        case 'bytes-asc':
          return a.totalBytes - b.totalBytes;
        case 'ip-asc':
          return a.ip.localeCompare(b.ip);
        case 'ip-desc':
          return b.ip.localeCompare(a.ip);
        case 'domain-asc':
          return (a.domain || '').localeCompare(b.domain || '');
        case 'recent-desc':
          return (b.lastSeen || '').localeCompare(a.lastSeen || '');
        default:
          return b.totalPackets - a.totalPackets;
      }
    });
}

export function groupAndSortProcesses(
  processes: ProcessTrafficPoint[],
  searchTerm: string,
  sortOption: AppSortOptionKey
): GroupedProcess[] {
  const filtered = !searchTerm
    ? processes
    : processes.filter(
        (proc) =>
          proc.processName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          proc.pid.toString().includes(searchTerm)
      );

  return groupProcessesByName(filtered).sort((a, b) => {
    switch (sortOption) {
      case 'bytes-desc':
        return b.totalBytes - a.totalBytes;
      case 'bytes-asc':
        return a.totalBytes - b.totalBytes;
      case 'packets-desc':
        return b.totalPackets - a.totalPackets;
      case 'name-asc':
        return a.processName.localeCompare(b.processName);
      case 'pid-asc':
        return b.pids.length - a.pids.length;
      default:
        return b.totalBytes - a.totalBytes;
    }
  });
}

export function filterAndSortGeoNodes(
  nodes: GeoNode[],
  searchTerm: string,
  sortOption: GeoSortOptionKey
): GeoNode[] {
  return nodes
    .filter((node) => {
      return (
        node.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.countryCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'ips-desc':
          return b.activeIpCount - a.activeIpCount;
        case 'ips-asc':
          return a.activeIpCount - b.activeIpCount;
        case 'bytes-desc':
          return b.totalBytes - a.totalBytes;
        case 'bytes-asc':
          return a.totalBytes - b.totalBytes;
        case 'country-asc':
          return a.country.localeCompare(b.country);
        default:
          return b.activeIpCount - a.activeIpCount;
      }
    });
}
