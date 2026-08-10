import React, { useState } from 'react';
import { IpSession } from '../types/network';
import { Search, ShieldCheck, ShieldAlert, ArrowUpDown, Globe, Server, CheckCircle2, SlidersHorizontal, Ban, ShieldX } from 'lucide-react';

interface IpTableProps {
  sessions: IpSession[];
  onToggleBaseline: (ip: string) => void;
  onVerifyNormal: (ip: string) => void;
  onToggleBlock: (ip: string) => void;
}

export type SortOptionKey =
  | 'packets-desc'
  | 'packets-asc'
  | 'bytes-desc'
  | 'bytes-asc'
  | 'ip-asc'
  | 'ip-desc'
  | 'domain-asc'
  | 'recent-desc';

export const IpTable: React.FC<IpTableProps> = ({ sessions, onToggleBaseline, onVerifyNormal, onToggleBlock }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'new' | 'normal' | 'suspicious' | 'baseline'>('all');
  const [sortOption, setSortOption] = useState<SortOptionKey>('packets-desc');

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

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">Communicating IP Sessions</h2>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-mono text-xs border border-slate-700">
            {filteredSessions.length} IPs
          </span>
        </div>

        {/* Search, Sort Dropdown & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search IP, Domain, Country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Versatile Sort Dropdown Menu (Positioned between Search and Filters) */}
          <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-500 font-mono text-[11px] hidden lg:inline">Sort:</span>
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

          {/* Filter Pills: All, New IPs, Normal, Suspicious, Baseline */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto justify-center">
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
              New IPs
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

      {/* IP Sessions Data Table with Inner Scrollbar & Sticky Header */}
      <div className="overflow-x-auto max-h-[800px] overflow-y-auto custom-scrollbar">
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
              <th className="py-3 px-4 text-right">Verification Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-mono">
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

                  {/* Interactive Verification Promotion & Firewall Block Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {session.status === 'blocked' ? (
                        <button
                          onClick={() => onToggleBlock(session.ip)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all"
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
    </div>
  );
};
