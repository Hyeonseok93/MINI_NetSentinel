import React, { useState } from 'react';
import { SpikeHistoryEntry } from '../types/network';
import { formatBytes } from '../utils/formatters';
import { History, Zap, ChevronDown, ChevronRight, Trash2, Cpu, Globe } from 'lucide-react';

interface HistoryFeedProps {
  entries: SpikeHistoryEntry[];
  onClear?: () => void;
  onDelete?: (id: string) => void;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({ entries, onClear, onDelete }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden min-w-0">
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-amber-400 shrink-0" />
          <h2 className="text-sm font-semibold text-slate-200 whitespace-nowrap">Spike History</h2>
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-slate-800 text-amber-300 border border-slate-700 whitespace-nowrap">
            {entries.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap hidden sm:inline">
            Top apps &amp; IPs at chart surges
          </span>
          {onClear && entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear all spike history snapshots?')) onClear();
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-rose-300 bg-slate-800/80 border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <Trash2 className="w-3 h-3" />
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-2.5 overflow-y-auto custom-scrollbar max-h-[800px]">
        {entries.length === 0 ? (
          <div className="py-14 text-center text-slate-500 font-mono text-xs space-y-2">
            <Zap className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No spike snapshots yet.</p>
            <p className="text-[11px] text-slate-600 max-w-md mx-auto">
              When total traffic exceeds the History Spike Threshold in Settings, a snapshot is stored here (memory only).
            </p>
          </div>
        ) : (
          entries.map((entry) => {
            const open = expandedId === entry.id;
            const totalPkts = entry.packetsIn + entry.packetsOut;
            return (
              <div
                key={entry.id}
                className="rounded-xl bg-slate-950/70 border border-slate-800/80 overflow-hidden"
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : entry.id)}
                    className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="text-slate-500 shrink-0">
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-400 shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="font-mono text-xs font-bold text-slate-100 whitespace-nowrap shrink-0">
                          {entry.timestamp}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-950 text-amber-300 border border-amber-800 whitespace-nowrap shrink-0">
                          {totalPkts} pkts/s
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                          {formatBytes(entry.bytesSec)}/s
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 truncate whitespace-nowrap">{entry.reason}</p>
                      {!open && (
                        <p className="text-[10px] text-slate-600 mt-1 font-mono truncate whitespace-nowrap">
                          {entry.topProcesses[0]
                            ? `App: ${entry.topProcesses[0].processName}`
                            : 'App: —'}
                          {' · '}
                          {entry.topIps[0] ? `IP: ${entry.topIps[0].ip}` : 'IP: —'}
                        </p>
                      )}
                    </div>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(entry.id);
                        if (expandedId === entry.id) setExpandedId(null);
                      }}
                      className="px-3.5 shrink-0 text-slate-500 hover:text-rose-300 hover:bg-rose-950/40 border-l border-slate-800/80 transition-colors"
                      title="Delete this snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {open && (
                  <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3 border-t border-slate-800/80 pt-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1 whitespace-nowrap">
                        <Cpu className="w-3 h-3" /> Top processes (that second)
                      </p>
                      {entry.topProcesses.length === 0 ? (
                        <p className="text-[11px] text-slate-600 font-mono">No process deltas</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {entry.topProcesses.map((p) => (
                            <li
                              key={p.processName}
                              className="flex items-center justify-between gap-3 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800"
                            >
                              <span className="text-slate-200 truncate">{p.processName}</span>
                              <span className="text-cyan-400 shrink-0 whitespace-nowrap">
                                {p.packets} pkts · {formatBytes(p.bytes)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1 whitespace-nowrap">
                        <Globe className="w-3 h-3" /> Top remote IPs (that second)
                      </p>
                      {entry.topIps.length === 0 ? (
                        <p className="text-[11px] text-slate-600 font-mono">No IP traffic</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {entry.topIps.map((ip) => (
                            <li
                              key={ip.ip}
                              className="flex items-center justify-between gap-3 text-[11px] font-mono px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800"
                            >
                              <div className="min-w-0">
                                <div className="text-slate-200 truncate whitespace-nowrap">{ip.ip}</div>
                                <div className="text-[10px] text-slate-500 truncate whitespace-nowrap">
                                  {ip.domain || ip.country}
                                  {ip.processHint ? ` · ${ip.processHint}` : ''}
                                </div>
                              </div>
                              <span className="text-emerald-400 shrink-0 whitespace-nowrap">
                                {ip.packets} pkts · {formatBytes(ip.bytes)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
