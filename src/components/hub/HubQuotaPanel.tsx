import React from 'react';
import { formatBytes } from '../../utils/formatters';
import { HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';

interface HubQuotaPanelProps {
  currentBytesToday: number;
  dailyQuotaBytes: number;
  quotaPercent: number;
  isQuotaWarning: boolean;
  isQuotaExceeded: boolean;
}

export const HubQuotaPanel: React.FC<HubQuotaPanelProps> = ({
  currentBytesToday,
  dailyQuotaBytes,
  quotaPercent,
  isQuotaWarning,
  isQuotaExceeded,
}) => {
  return (
    <div className="w-full">
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
  );
};
