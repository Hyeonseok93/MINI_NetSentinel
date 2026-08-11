import React, { useState } from 'react';
import { IpSession, ProcessTrafficPoint, GeoNode } from '../types/network';
import { HubSessionsTable } from './hub/HubSessionsTable';
import { HubAppsGrid, GroupedProcess } from './hub/HubAppsGrid';
import { HubGeoGrid } from './hub/HubGeoGrid';
import { HubQuotaPanel } from './hub/HubQuotaPanel';
import {
  Server,
  Cpu,
  Globe2,
  HardDrive,
  Search,
  SlidersHorizontal,
  Zap,
  TrendingUp,
  Trash2,
} from 'lucide-react';

interface EnterpriseHubCardProps {
  sessions: IpSession[];
  processes: ProcessTrafficPoint[];
  cumulativeProcesses?: ProcessTrafficPoint[];
  geoNodes: GeoNode[];
  cumulativeGeoNodes?: GeoNode[];
  myPublicGeo?: { country: string; countryCode: string };
  currentBytesToday: number;
  dailyQuotaBytes: number;
  onToggleBaseline: (ip: string) => void;
  onVerifyNormal: (ip: string) => void;
  onToggleBlock: (ip: string) => void;
  onClearCumulativeProcesses?: () => void;
  onClearCumulativeGeoNodes?: () => void;
}

export type MainTabKey = 'sessions' | 'apps' | 'geo' | 'quota';

export type SortOptionKey =
  | 'packets-desc'
  | 'packets-asc'
  | 'bytes-desc'
  | 'bytes-asc'
  | 'ip-asc'
  | 'ip-desc'
  | 'domain-asc'
  | 'recent-desc';

export type AppSortOptionKey =
  | 'bytes-desc'
  | 'bytes-asc'
  | 'packets-desc'
  | 'name-asc'
  | 'pid-asc';

export type GeoSortOptionKey =
  | 'ips-desc'
  | 'ips-asc'
  | 'bytes-desc'
  | 'bytes-asc'
  | 'country-asc';

export const EnterpriseHubCard: React.FC<EnterpriseHubCardProps> = ({
  sessions,
  processes,
  cumulativeProcesses = [],
  geoNodes,
  cumulativeGeoNodes = [],
  myPublicGeo = { country: 'South Korea', countryCode: 'KR' },
  currentBytesToday,
  dailyQuotaBytes,
  onToggleBaseline,
  onVerifyNormal,
  onToggleBlock,
  onClearCumulativeProcesses,
  onClearCumulativeGeoNodes,
}) => {
  const [activeTab, setActiveTab] = useState<MainTabKey>('sessions');

  // IP Table Filter & Sort State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'new' | 'normal' | 'suspicious' | 'baseline'>('all');
  const [sortOption, setSortOption] = useState<SortOptionKey>('packets-desc');

  // App Breakdown Sub-Tab, Search & Sort State
  const [appSubTab, setAppSubTab] = useState<'live' | 'cumulative'>('cumulative');
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [appSortOption, setAppSortOption] = useState<AppSortOptionKey>('bytes-desc');

  // Geo Threat Map Sub-Tab, Search & Sort State
  const [geoSubTab, setGeoSubTab] = useState<'live' | 'cumulative'>('live');
  const [geoSearchTerm, setGeoSearchTerm] = useState('');
  const [geoSortOption, setGeoSortOption] = useState<GeoSortOptionKey>('ips-desc');

  // 1. IP Sessions Filter & Sort
  const filteredSessions = sessions
    .filter((s) => {
      const matchSearch =
        s.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.domain && s.domain.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.country.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === 'new') return s.status === 'new';
      if (filterType === 'normal') return s.status === 'normal' && !s.isBaseline;
      if (filterType === 'suspicious') return s.status === 'suspicious';
      if (filterType === 'baseline') return s.isBaseline;
      return true;
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
          return a.ip.localeCompare(b.ip, undefined, { numeric: true });
        case 'ip-desc':
          return b.ip.localeCompare(a.ip, undefined, { numeric: true });
        case 'domain-asc':
          return (a.domain || 'zzz').localeCompare(b.domain || 'zzz');
        case 'recent-desc':
          return (b.lastSeen || '').localeCompare(a.lastSeen || '');
        default:
          return b.totalPackets - a.totalPackets;
      }
    });

  // 2. App Breakdown Grouped Aggregation
  const liveAppNames = new Set(processes.map((p) => p.processName));
  const cumulativeAppNames = new Set(cumulativeProcesses.map((p) => p.processName));

  const targetProcesses = appSubTab === 'cumulative' ? (cumulativeProcesses.length > 0 ? cumulativeProcesses : processes) : processes;
  const groupedAppMap = new Map<string, GroupedProcess>();

  targetProcesses.forEach((proc) => {
    if (
      appSearchTerm &&
      !proc.processName.toLowerCase().includes(appSearchTerm.toLowerCase()) &&
      !proc.pid.toString().includes(appSearchTerm)
    ) {
      return;
    }

    if (!groupedAppMap.has(proc.processName)) {
      groupedAppMap.set(proc.processName, {
        processName: proc.processName,
        totalBytes: proc.bytesTotal,
        totalPackets: proc.totalPackets,
        packetsIn: proc.packetsIn,
        packetsOut: proc.packetsOut,
        iconType: proc.iconType,
        pids: [{ ...proc }],
      });
    } else {
      const existing = groupedAppMap.get(proc.processName)!;
      existing.totalBytes += proc.bytesTotal;
      existing.totalPackets += proc.totalPackets;
      existing.packetsIn += proc.packetsIn;
      existing.packetsOut += proc.packetsOut;

      if (!existing.pids.some((p) => p.pid === proc.pid)) {
        existing.pids.push({ ...proc });
      }
    }
  });

  const groupedProcesses = Array.from(groupedAppMap.values()).sort((a, b) => {
    switch (appSortOption) {
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

  const maxAppBytes = Math.max(...groupedProcesses.map((g) => (appSubTab === 'live' ? Math.floor(g.totalBytes / 10) : g.totalBytes)), 1);

  // 3. Geo Threat Map Filtering & Sorting
  const targetGeoNodes = geoSubTab === 'cumulative' ? (cumulativeGeoNodes.length > 0 ? cumulativeGeoNodes : geoNodes) : geoNodes;

  const filteredGeoNodes = targetGeoNodes
    .filter((node) => {
      return (
        node.country.toLowerCase().includes(geoSearchTerm.toLowerCase()) ||
        node.countryCode.toLowerCase().includes(geoSearchTerm.toLowerCase())
      );
    })
    .sort((a, b) => {
      switch (geoSortOption) {
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

  // 4. Quota Calculations
  const quotaPercent = Math.min(Math.round((currentBytesToday / dailyQuotaBytes) * 100), 100);
  const isQuotaWarning = quotaPercent >= 80;
  const isQuotaExceeded = quotaPercent >= 100;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col space-y-0">
      {/* 4-Equal-Width Full Span Top Navigation Bar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
              activeTab === 'sessions'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 glow-cyan shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
            }`}
          >
            <Server className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">IP Sessions</span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-cyan-300 font-mono">
              {filteredSessions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('apps')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
              activeTab === 'apps'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 glow-purple shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="truncate">App Breakdown</span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-purple-300 font-mono">
              {groupedProcesses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('geo')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
              activeTab === 'geo'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 glow-emerald shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
            }`}
          >
            <Globe2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">Geo Threat Map</span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-emerald-300 font-mono">
              {filteredGeoNodes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('quota')}
            className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
              activeTab === 'quota'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 glow-amber shadow-md'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
            }`}
          >
            <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">Bandwidth Quota</span>
            <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-amber-300 font-mono">
              {quotaPercent}%
            </span>
          </button>
        </div>

        {/* Tab-Specific Secondary Controls Bar */}
        {activeTab === 'sessions' && (
          <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Server className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold text-slate-200">Active Network Sessions</h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Search Box */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search IP, Domain, Country..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOptionKey)}
                  className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer border-none p-0 pr-1"
                >
                  <option value="packets-desc" className="bg-slate-900 text-slate-200">Packets (Highest First)</option>
                  <option value="packets-asc" className="bg-slate-900 text-slate-200">Packets (Lowest First)</option>
                  <option value="bytes-desc" className="bg-slate-900 text-slate-200">Volume (Highest First)</option>
                  <option value="bytes-asc" className="bg-slate-900 text-slate-200">Volume (Lowest First)</option>
                  <option value="ip-asc" className="bg-slate-900 text-slate-200">IP Address (0-9 / A-Z)</option>
                  <option value="ip-desc" className="bg-slate-900 text-slate-200">IP Address (Z-A)</option>
                  <option value="domain-asc" className="bg-slate-900 text-slate-200">Domain Name (A-Z)</option>
                  <option value="recent-desc" className="bg-slate-900 text-slate-200">Last Activity (Recent First)</option>
                </select>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto justify-center">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filterType === 'all' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('new')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filterType === 'new' ? 'bg-amber-500/20 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  New
                </button>
                <button
                  onClick={() => setFilterType('normal')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filterType === 'normal' ? 'bg-sky-500/20 text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => setFilterType('suspicious')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filterType === 'suspicious' ? 'bg-rose-500/20 text-rose-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Suspicious
                </button>
                <button
                  onClick={() => setFilterType('baseline')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    filterType === 'baseline' ? 'bg-emerald-500/20 text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Baseline
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'apps' && (
          <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 w-full">
            {/* App Sub-Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                onClick={() => setAppSubTab('live')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  appSubTab === 'live'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
                <span>Live Real-time</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-purple-300 font-mono border border-purple-500/30">
                  {liveAppNames.size}
                </span>
              </button>

              <button
                onClick={() => setAppSubTab('cumulative')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  appSubTab === 'cumulative'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Cumulative Total</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-cyan-300 font-mono border border-cyan-500/30">
                  {Math.max(cumulativeAppNames.size, liveAppNames.size)}
                </span>
              </button>
            </div>

            {/* Right Controls: Search + Sort Dropdown + Clear History Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              {/* App Search Box */}
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search App or PID..."
                  value={appSearchTerm}
                  onChange={(e) => setAppSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                />
              </div>

              {/* App Sort Dropdown */}
              <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <select
                  value={appSortOption}
                  onChange={(e) => setAppSortOption(e.target.value as AppSortOptionKey)}
                  className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer border-none p-0 pr-1"
                >
                  <option value="bytes-desc" className="bg-slate-900 text-slate-200">Bandwidth (Highest First)</option>
                  <option value="bytes-asc" className="bg-slate-900 text-slate-200">Bandwidth (Lowest First)</option>
                  <option value="packets-desc" className="bg-slate-900 text-slate-200">Packets (Highest First)</option>
                  <option value="name-asc" className="bg-slate-900 text-slate-200">Process Name (A-Z)</option>
                  <option value="pid-asc" className="bg-slate-900 text-slate-200">Most Active PIDs</option>
                </select>
              </div>

              {/* Clear History Button */}
              {appSubTab === 'cumulative' && onClearCumulativeProcesses && (
                <button
                  onClick={onClearCumulativeProcesses}
                  className="py-1.5 px-3 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                  title="Clear accumulated process history"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'geo' && (
          <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 w-full">
            {/* Geo Sub-Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
              <button
                onClick={() => setGeoSubTab('live')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  geoSubTab === 'live'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                <span>Live Real-time</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-emerald-300 font-mono border border-emerald-500/30">
                  {geoNodes.length}
                </span>
              </button>

              <button
                onClick={() => setGeoSubTab('cumulative')}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  geoSubTab === 'cumulative'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Cumulative Total</span>
                <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-cyan-300 font-mono border border-cyan-500/30">
                  {cumulativeGeoNodes.length > 0 ? cumulativeGeoNodes.length : geoNodes.length}
                </span>
              </button>
            </div>

            {/* Geo Controls: Search + Sort Dropdown + Clear History Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <span className="text-[11px] font-mono text-emerald-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 hidden xl:inline-block shrink-0">
                Source PC: {myPublicGeo.countryCode} ({myPublicGeo.country})
              </span>

              {/* Geo Search Box */}
              <div className="relative w-full sm:w-44">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search Country..."
                  value={geoSearchTerm}
                  onChange={(e) => setGeoSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Geo Sort Dropdown */}
              <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <select
                  value={geoSortOption}
                  onChange={(e) => setGeoSortOption(e.target.value as GeoSortOptionKey)}
                  className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer border-none p-0 pr-1"
                >
                  <option value="ips-desc" className="bg-slate-900 text-slate-200">Active IPs (Highest First)</option>
                  <option value="ips-asc" className="bg-slate-900 text-slate-200">Active IPs (Lowest First)</option>
                  <option value="bytes-desc" className="bg-slate-900 text-slate-200">Volume (Highest First)</option>
                  <option value="bytes-asc" className="bg-slate-900 text-slate-200">Volume (Lowest First)</option>
                  <option value="country-asc" className="bg-slate-900 text-slate-200">Country Name (A-Z)</option>
                </select>
              </div>

              {/* Clear History Button */}
              {geoSubTab === 'cumulative' && onClearCumulativeGeoNodes && (
                <button
                  onClick={onClearCumulativeGeoNodes}
                  className="py-1.5 px-3 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                  title="Clear accumulated geo node history"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'quota' && (
          <div className="pt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-slate-200">Daily Network Usage & Quota Limit</h3>
            </div>
          </div>
        )}
      </div>

      {/* Shared Container with Shared Max Height & Custom Scrollbar */}
      <div className="max-h-[800px] overflow-y-auto custom-scrollbar flex-1">
        {activeTab === 'sessions' && (
          <HubSessionsTable
            sessions={filteredSessions}
            onToggleBaseline={onToggleBaseline}
            onVerifyNormal={onVerifyNormal}
            onToggleBlock={onToggleBlock}
          />
        )}

        {activeTab === 'apps' && (
          <HubAppsGrid
            groupedProcesses={groupedProcesses}
            appSubTab={appSubTab}
            maxAppBytes={maxAppBytes}
          />
        )}

        {activeTab === 'geo' && (
          <HubGeoGrid filteredGeoNodes={filteredGeoNodes} />
        )}

        {activeTab === 'quota' && (
          <HubQuotaPanel
            currentBytesToday={currentBytesToday}
            dailyQuotaBytes={dailyQuotaBytes}
            quotaPercent={quotaPercent}
            isQuotaWarning={isQuotaWarning}
            isQuotaExceeded={isQuotaExceeded}
          />
        )}
      </div>
    </div>
  );
};
