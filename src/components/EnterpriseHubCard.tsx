import React, { useState } from 'react';
import { IpSession, ProcessTrafficPoint, GeoNode } from '../types/network';
import {
  Server,
  Cpu,
  Globe2,
  HardDrive,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Ban,
  ShieldX,
  Globe,
  Navigation,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Shield,
  Gamepad2,
  Code,
  Cloud,
  Zap,
  TrendingUp,
  Trash2,
  HelpCircle,
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

  // Geo Threat Map Sub-Tab State
  const [geoSubTab, setGeoSubTab] = useState<'live' | 'cumulative'>('live');
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [appSortOption, setAppSortOption] = useState<AppSortOptionKey>('bytes-desc');

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

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

  const targetProcesses = appSubTab === 'cumulative' ? (cumulativeProcesses.length > 0 ? cumulativeProcesses : processes) : processes;

  const filteredProcesses = targetProcesses
    .filter((p) => {
      return (
        p.processName.toLowerCase().includes(appSearchTerm.toLowerCase()) ||
        p.pid.toString().includes(appSearchTerm)
      );
    })
    .sort((a, b) => {
      switch (appSortOption) {
        case 'bytes-desc':
          return b.bytesTotal - a.bytesTotal;
        case 'bytes-asc':
          return a.bytesTotal - b.bytesTotal;
        case 'packets-desc':
          return b.totalPackets - a.totalPackets;
        case 'name-asc':
          return a.processName.localeCompare(b.processName);
        case 'pid-asc':
          return a.pid - b.pid;
        default:
          return b.bytesTotal - a.bytesTotal;
      }
    });

  const maxProcessBytes = Math.max(...processes.map((p) => (appSubTab === 'live' ? Math.floor(p.bytesTotal / 10) : p.bytesTotal)), 1);
  const quotaPercent = Math.min(Math.round((currentBytesToday / dailyQuotaBytes) * 100), 100);
  const isQuotaWarning = quotaPercent >= 80;
  const isQuotaExceeded = quotaPercent >= 100;

  const renderProcIcon = (type: ProcessTrafficPoint['iconType']) => {
    switch (type) {
      case 'browser':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'system':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'game':
        return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
      case 'code':
        return <Code className="w-4 h-4 text-sky-400" />;
      case 'cloud':
        return <Cloud className="w-4 h-4 text-blue-400" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-400" />;
    }
  };

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
              {processes.length}
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
              {geoNodes.length}
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
            {/* App Sub-Tabs (Strict Single Line - No Wrap) */}
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
                  {processes.length}
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
                  {cumulativeProcesses.length > 0 ? cumulativeProcesses.length : processes.length}
                </span>
              </button>
            </div>

            {/* Right Controls: Search + Sort Dropdown + Clear History Button (Moved here!) */}
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
                  <option value="pid-asc" className="bg-slate-900 text-slate-200">Process PID (Low to High)</option>
                </select>
              </div>

              {/* Clear History Button (Placed cleanly on the right for Cumulative Mode) */}
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
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
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

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-emerald-400 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 hidden md:inline-block">
                Source PC: {myPublicGeo.countryCode} ({myPublicGeo.country})
              </span>

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
            {isQuotaExceeded ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800 animate-pulse font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> EXCEEDED
              </span>
            ) : isQuotaWarning ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> 80% Threshold
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                <CheckCircle className="w-3.5 h-3.5" /> Within Cap
              </span>
            )}
          </div>
        )}
      </div>

      {/* Shared Container with Shared Max Height & Custom Scrollbar */}
      <div className="max-h-[800px] overflow-y-auto custom-scrollbar flex-1">
        {/* TAB 1: IP Sessions Table */}
        {activeTab === 'sessions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-20 shadow-md">
                <tr className="text-slate-400 border-b border-slate-800 font-medium">
                  <th className="py-3 px-4">Status & IP Address</th>
                  <th className="py-3 px-4">Resolved Domain</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Protocol/Port</th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <span>Packets (In / Out)</span>
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <span>Total Volume</span>
                      <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Last Seen</th>
                  <th className="py-3 px-4 text-right">Verification & Firewall Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                      No IP sessions match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => (
                    <tr
                      key={session.id}
                      className="hover:bg-slate-900/50 transition-colors group text-slate-300"
                    >
                      {/* Status & IP */}
                      <td className="py-3 px-4 font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {session.status === 'blocked' ? (
                            <span className="w-2 h-2 rounded-full bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,1)]" title="Firewall Blocked" />
                          ) : session.isBaseline ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" title="Trusted Baseline" />
                          ) : session.status === 'suspicious' ? (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-ping" title="Suspicious Threat" />
                          ) : session.status === 'new' ? (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse" title="New Initial Connection" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-sky-400" title="Normal Session" />
                          )}
                          <span className={`text-slate-100 group-hover:text-cyan-300 transition-colors ${session.status === 'blocked' ? 'line-through opacity-50' : ''}`}>
                            {session.ip}
                          </span>
                          {session.status === 'blocked' ? (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-rose-950 text-rose-400 border border-rose-800">
                              BLOCKED
                            </span>
                          ) : session.status === 'new' && !session.isBaseline ? (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              NEW
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {session.domain ? (
                          <span className="text-slate-200">{session.domain}</span>
                        ) : (
                          <span className="text-slate-600 italic">Unresolved</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Globe className="w-3 h-3 text-slate-500" />
                          <span>{session.country}</span>
                        </div>
                      </td>

                      {/* Protocol / Port */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {session.protocol}:{session.port}
                        </span>
                      </td>

                      {/* Packets */}
                      <td className="py-3 px-4 font-mono text-slate-200">
                        <span className="text-cyan-400 font-semibold">{session.totalPackets.toLocaleString()}</span>
                        <span className="text-slate-500 text-[10px] ml-1">
                          ({session.packetsIn} ↓ / {session.packetsOut} ↑)
                        </span>
                      </td>

                      {/* Bytes */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {formatBytes(session.totalBytes)}
                      </td>

                      {/* Last Seen */}
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-mono">
                        {session.lastSeen}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {session.status === 'blocked' ? (
                            <button
                              onClick={() => onToggleBlock(session.ip)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all"
                              title="Unblock IP in Firewall"
                            >
                              <ShieldX className="w-3.5 h-3.5 text-rose-400" />
                              <span>Unblock IP</span>
                            </button>
                          ) : (
                            <>
                              {session.isBaseline ? (
                                <button
                                  onClick={() => onToggleBaseline(session.ip)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-rose-950/50 hover:text-rose-400 hover:border-rose-800 transition-all"
                                  title="Click to remove from trusted baseline"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Trusted (Baseline)</span>
                                </button>
                              ) : session.status === 'new' ? (
                                <button
                                  onClick={() => onVerifyNormal(session.ip)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-sm transition-all"
                                  title="Verify this initial connection as Normal"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Verify Normal</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => onToggleBaseline(session.ip)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 text-sky-400 border border-slate-800 hover:bg-emerald-950/50 hover:text-emerald-300 hover:border-emerald-800 transition-all"
                                  title="Promote to Trusted Baseline"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
                                  <span>Trust IP</span>
                                </button>
                              )}

                              <button
                                onClick={() => onToggleBlock(session.ip)}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/50 transition-all"
                                title="Instant Firewall Kill-Switch Block"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: App Breakdown Full View */}
        {activeTab === 'apps' && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProcesses.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-slate-500 font-mono">
                  No Windows app processes match the search criteria.
                </div>
              ) : (
                filteredProcesses.map((proc) => {
                  const currentDisplayBytes = appSubTab === 'live' ? Math.floor(proc.bytesTotal / 10) : proc.bytesTotal;
                  const percent = Math.min(Math.round((currentDisplayBytes / maxProcessBytes) * 100), 100);

                  return (
                    <div key={`${proc.processName}-${proc.pid}`} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2 hover:border-purple-500/40 transition-all">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                            {renderProcIcon(proc.iconType)}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-100">{proc.processName}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">PID: {proc.pid}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-purple-400">
                            {formatBytes(currentDisplayBytes)}
                            {appSubTab === 'live' ? '/s' : ''}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {appSubTab === 'live'
                              ? `${Math.floor(proc.packetsIn / 5)} ↓ / ${Math.floor(proc.packetsOut / 5)} ↑ pkts/s`
                              : `${proc.packetsIn.toLocaleString()} ↓ / ${proc.packetsOut.toLocaleString()} ↑ pkts`}
                          </div>
                        </div>
                      </div>

                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            appSubTab === 'live'
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]'
                              : 'bg-gradient-to-r from-purple-500 to-cyan-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Geo Threat Map Full View */}
        {activeTab === 'geo' && (
          <div className="p-6 space-y-6">
            <div className="relative w-full min-h-[22rem] bg-slate-950/90 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:24px_24px]" />

              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
                {(geoSubTab === 'cumulative' ? (cumulativeGeoNodes.length > 0 ? cumulativeGeoNodes : geoNodes) : geoNodes).map((node) => {
                  const isUnknown = node.countryCode === 'UNK' || node.country === 'Unknown Location';

                  return (
                    <div
                      key={node.country}
                      className={`p-4 rounded-xl bg-slate-900/90 border flex flex-col items-center justify-center text-center gap-2 shadow-xl transition-all ${
                        isUnknown
                          ? 'border-purple-800/80 hover:border-purple-500/80 bg-purple-950/20'
                          : 'border-slate-800 hover:border-emerald-500/50'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-xl border ${
                          isUnknown
                            ? 'bg-purple-950/80 text-purple-400 border-purple-800/60'
                            : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                        }`}
                      >
                        {isUnknown ? <HelpCircle className="w-5 h-5 text-purple-400" /> : <Navigation className="w-5 h-5" />}
                      </div>
                      <span className="font-bold text-xs text-slate-100">{node.country} ({node.countryCode})</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          isUnknown
                            ? 'text-purple-300 bg-purple-950/80 border-purple-800/60'
                            : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                        }`}
                      >
                        {node.activeIpCount} Active IPs
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{formatBytes(node.totalBytes)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Bandwidth Quota Full View */}
        {activeTab === 'quota' && (
          <div className="p-6 space-y-6 max-w-3xl mx-auto">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base text-slate-100">Daily Bandwidth Quota Monitor</h3>
                </div>

                {isQuotaExceeded ? (
                  <span className="flex items-center gap-1 text-xs font-mono text-rose-400 bg-rose-950/80 px-3 py-1 rounded-lg border border-rose-800 animate-pulse font-bold">
                    <AlertTriangle className="w-4 h-4" /> QUOTA EXCEEDED
                  </span>
                ) : isQuotaWarning ? (
                  <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-950/80 px-3 py-1 rounded-lg border border-amber-800 font-bold">
                    <AlertTriangle className="w-4 h-4" /> 80% Threshold Reached
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800">
                    <CheckCircle className="w-4 h-4" /> Within Normal Cap
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-mono">
                  <span className="text-slate-400">Total Today Usage:</span>
                  <div className="text-right">
                    <span className="font-bold text-amber-300 text-base">{formatBytes(currentBytesToday)}</span>
                    <span className="text-slate-500 text-xs"> / {formatBytes(dailyQuotaBytes)} Limit</span>
                  </div>
                </div>

                <div className="h-4 w-full bg-slate-950 rounded-full p-0.5 border border-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isQuotaExceeded
                        ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                        : isQuotaWarning
                        ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                        : 'bg-gradient-to-r from-amber-500 to-cyan-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                    }`}
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1">
                  <span>0 GB</span>
                  <span className="font-bold text-slate-300">{quotaPercent}% Consumed</span>
                  <span>{formatBytes(dailyQuotaBytes)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
