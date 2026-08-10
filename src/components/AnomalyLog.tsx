import React from 'react';
import { AnomalyEvent } from '../types/network';
import { ShieldAlert, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface AnomalyLogProps {
  anomalies: AnomalyEvent[];
  onResolve: (id: string) => void;
}

export const AnomalyLog: React.FC<AnomalyLogProps> = ({ anomalies, onResolve }) => {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-semibold text-slate-200">Anomaly & Event Audit Feed</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {anomalies.filter(a => !a.resolved).length} Unresolved
        </span>
      </div>

      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {anomalies.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No anomaly events detected. Baseline status is normal.
          </div>
        ) : (
          anomalies.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                event.resolved
                  ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                  : event.severity === 'high'
                  ? 'bg-rose-950/20 border-rose-800/50 glow-rose'
                  : 'bg-amber-950/20 border-amber-800/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {event.type === 'TRAFFIC_SPIKE' ? (
                    <Zap className="w-4 h-4 text-amber-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-200">{event.ip}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-900 border border-slate-800 text-slate-400">
                      {event.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{event.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{event.message}</p>
                </div>
              </div>

              <div>
                {!event.resolved ? (
                  <button
                    onClick={() => onResolve(event.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Acknowledge</span>
                  </button>
                ) : (
                  <span className="text-xs text-emerald-500 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolved
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
