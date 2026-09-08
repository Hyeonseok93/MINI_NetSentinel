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

/** Full-width table; leftover width goes to Domain/Location, not Proto/Seen/Actions. */
export const HubSessionsTable: React.FC<HubSessionsTableProps> = ({
  sessions,
  onToggleBaseline,
  onVerifyNormal,
  onToggleBlock,
}) => {
  return (
    <div className="w-full overflow-x-hidden">
      <table className="w-full table-fixed text-left text-xs border-collapse">
        <colgroup>
          <col style={{ width: '15%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-20 shadow-md">
          <tr className="text-slate-400 border-b border-slate-800 font-medium">
            <th className="py-2 px-1.5 whitespace-nowrap">Status / IP</th>
            <th className="py-2 px-1.5 whitespace-nowrap">Domain</th>
            <th className="py-2 px-1.5 whitespace-nowrap">Location</th>
            <th className="py-2 px-1 whitespace-nowrap">Proto</th>
            <th className="py-2 px-1.5 whitespace-nowrap">
              <div className="flex items-center gap-0.5">
                <span>Packets</span>
                <ArrowUpDown className="w-3 h-3 text-cyan-400 shrink-0" />
              </div>
            </th>
            <th className="py-2 px-1 whitespace-nowrap">
              <div className="flex items-center gap-0.5">
                <span>Volume</span>
                <ArrowUpDown className="w-3 h-3 text-cyan-400 shrink-0" />
              </div>
            </th>
            <th className="py-2 px-1.5 whitespace-nowrap">Seen</th>
            <th className="py-2 px-1.5 whitespace-nowrap">Actions</th>
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
                <td className="py-1.5 px-1.5 font-mono font-medium">
                  <div className="flex items-center gap-1 min-w-0">
                    {session.status === 'blocked' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Firewall Blocked" />
                    ) : session.isBaseline ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Trusted Baseline" />
                    ) : session.status === 'spike' ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" title="Traffic spike" />
                    ) : session.status === 'new' ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" title="New Initial Connection" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" title="Normal Session" />
                    )}
                    <span
                      className={`text-slate-100 truncate group-hover:text-cyan-300 transition-colors ${
                        session.status === 'blocked' ? 'line-through opacity-50' : ''
                      }`}
                      title={session.ip}
                    >
                      {session.ip}
                    </span>
                    {session.status === 'blocked' ? (
                      <span className="px-1 text-[9px] font-bold rounded bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                        BLOCK
                      </span>
                    ) : session.isBaseline ? (
                      <span className="px-1 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        TRUST
                      </span>
                    ) : session.status === 'normal' ? (
                      <span className="px-1 text-[9px] font-bold rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                        OK
                      </span>
                    ) : session.status === 'spike' ? (
                      <span className="px-1 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                        SPIKE
                      </span>
                    ) : session.status === 'new' ? (
                      <span className="px-1 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        NEW
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="py-1.5 px-1.5 font-mono text-slate-400">
                  {session.domain ? (
                    <span className="text-slate-200 truncate block" title={session.domain}>
                      {session.domain}
                    </span>
                  ) : (
                    <span className="text-slate-600 italic">—</span>
                  )}
                </td>

                <td className="py-1.5 px-1.5">
                  <div className="flex items-center gap-1 text-slate-300 min-w-0">
                    <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="truncate" title={session.country}>
                      {session.country}
                    </span>
                  </div>
                </td>

                <td className="py-1.5 px-1 whitespace-nowrap">
                  <span className="px-1 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {session.protocol}:{session.port}
                  </span>
                </td>

                <td className="py-1.5 px-1.5 font-mono text-slate-200 whitespace-nowrap">
                  <span className="text-cyan-400 font-semibold">{session.totalPackets.toLocaleString()}</span>
                  <span className="text-slate-500 text-[10px] ml-0.5">
                    ({session.packetsIn}/{session.packetsOut})
                  </span>
                </td>

                <td className="py-1.5 px-1 font-mono text-slate-300 whitespace-nowrap">
                  {formatBytes(session.totalBytes)}
                </td>

                <td className="py-1.5 px-1.5 text-slate-400 text-[11px] font-mono whitespace-nowrap truncate" title={session.lastSeen}>
                  {session.lastSeen}
                </td>

                <td className="py-1.5 px-1.5 whitespace-nowrap">
                  <div className="inline-flex items-center gap-0.5">
                    {session.status !== 'blocked' && (
                      <>
                        {session.isBaseline ? (
                          <button
                            onClick={() => onToggleBaseline(session.ip)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-rose-950/50 hover:text-rose-400 hover:border-rose-800 transition-all"
                            title="Remove from trusted baseline"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Trusted</span>
                          </button>
                        ) : session.status === 'normal' ? (
                          <button
                            onClick={() => onToggleBaseline(session.ip)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-medium bg-slate-900 text-sky-400 border border-slate-800 hover:bg-emerald-950/50 hover:text-emerald-300 transition-all"
                            title="Promote to Trusted Baseline"
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>Trust</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onVerifyNormal(session.ip)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all"
                            title="Verify as Normal"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verify</span>
                          </button>
                        )}
                      </>
                    )}

                    {session.status === 'blocked' ? (
                      <button
                        onClick={() => onToggleBlock(session.ip)}
                        className="p-1 rounded-md text-rose-400 bg-rose-950/40 border border-rose-800/50 hover:bg-rose-900/50 transition-all"
                        title="Unblock IP"
                      >
                        <ShieldX className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onToggleBlock(session.ip)}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/50 transition-all"
                        title="Block IP"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
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
