import React from 'react';
import { IpSession } from '../../types/network';
import { formatBytes } from '../../utils/formatters';
import {
  ArrowUpDown,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Ban,
  ShieldX,
  Globe,
} from 'lucide-react';

interface HubSessionsTableProps {
  sessions: IpSession[];
  onToggleBaseline: (ip: string) => void;
  onVerifyNormal: (ip: string) => void;
  onToggleBlock: (ip: string) => void;
}

export const HubSessionsTable: React.FC<HubSessionsTableProps> = ({
  sessions,
  onToggleBaseline,
  onVerifyNormal,
  onToggleBlock,
}) => {
  return (
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
          {sessions.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-slate-500 font-mono">
                No IP sessions match current filter criteria.
              </td>
            </tr>
          ) : (
            sessions.map((session) => (
              <tr
                key={session.ip}
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
  );
};
