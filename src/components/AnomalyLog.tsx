import React from 'react';
import { AnomalyEvent } from '../types/network';
import { ShieldAlert, AlertCircle, CheckCircle2, Zap, Trash2 } from 'lucide-react';

interface AnomalyLogProps {
  anomalies: AnomalyEvent[];
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onClearResolved?: () => void;
  /** Full-height panel when shown as a top-level tab */
  expanded?: boolean;
}

export const AnomalyLog: React.FC<AnomalyLogProps> = ({
  anomalies,
  onResolve,
  onDelete,
  onClearResolved,
  expanded = false,
}) => {
  const unresolvedCount = anomalies.filter((a) => !a.resolved).length;
  const resolvedCount = anomalies.length - unresolvedCount;
  const badgeLabel = unresolvedCount > 99 ? '99+' : String(unresolvedCount);

  return (
    <div
      className={`glass-panel rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden ${
        expanded ? '' : 'mb-6 p-5'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 flex-wrap ${
          expanded ? 'p-4 border-b border-slate-800 bg-slate-900/90' : 'mb-4'
        }`}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-semibold text-slate-200">Event log</h2>
          {unresolvedCount > 0 && (
            <span
              className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full"
              title={`${unresolvedCount} unresolved events`}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">
            {unresolvedCount} Unresolved · {resolvedCount} Resolved · {anomalies.length} Total
          </span>
          {onClearResolved && resolvedCount > 0 && (
            <button
              onClick={onClearResolved}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-800/50 transition-colors"
              title="Delete all resolved events"
            >
              Clear Resolved
            </button>
          )}
        </div>
      </div>

      <div
        className={`space-y-2.5 overflow-y-auto custom-scrollbar ${
          expanded ? 'p-6 max-h-[800px] flex-1 flex flex-col gap-2.5' : 'max-h-56 pr-1'
        }`}
      >
        {anomalies.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No events yet. Spikes appear when an IP exceeds the packet-rate threshold; new-IP notices need Settings enabled.
          </div>
        ) : (
          anomalies.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                event.resolved
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-70'
                  : event.severity === 'high'
                    ? 'bg-rose-950/20 border-rose-800/50 glow-rose'
                    : 'bg-amber-950/20 border-amber-800/50'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {event.type === 'TRAFFIC_SPIKE' ? (
                    <Zap className="w-4 h-4 text-amber-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-slate-200">{event.ip}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-900 border border-slate-800 text-slate-400">
                      {event.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{event.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 break-words">{event.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!event.resolved ? (
                  <button
                    onClick={() => onResolve(event.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Acknowledge</span>
                  </button>
                ) : (
                  <span className="text-xs text-emerald-500 font-mono flex items-center gap-1 px-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolved
                  </span>
                )}
                <button
                  onClick={() => onDelete(event.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/50 transition-all"
                  title="Delete this event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
