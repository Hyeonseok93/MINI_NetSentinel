import React from 'react';
import { HardDrive, AlertTriangle, CheckCircle } from 'lucide-react';

interface BandwidthQuotaCardProps {
  currentBytesToday: number;
  dailyQuotaBytes: number;
}

export const BandwidthQuotaCard: React.FC<BandwidthQuotaCardProps> = ({
  currentBytesToday,
  dailyQuotaBytes,
}) => {
  const percent = Math.min(Math.round((currentBytesToday / dailyQuotaBytes) * 100), 100);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isWarning = percent >= 80;
  const isExceeded = percent >= 100;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-slate-200">Daily Bandwidth Quota Monitor</h2>
        </div>

        {isExceeded ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-800 animate-pulse font-bold">
            <AlertTriangle className="w-3 h-3" /> QUOTA EXCEEDED
          </span>
        ) : isWarning ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800 font-bold">
            <AlertTriangle className="w-3 h-3" /> 80% Threshold
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800">
            <CheckCircle className="w-3 h-3" /> Within Limit
          </span>
        )}
      </div>

      {/* Quota Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Daily Consumption:</span>
          <div className="text-right">
            <span className="font-bold text-purple-300">{formatBytes(currentBytesToday)}</span>
            <span className="text-slate-500 text-[10px]"> / {formatBytes(dailyQuotaBytes)} Limit</span>
          </div>
        </div>

        <div className="h-3 w-full bg-slate-900 rounded-full p-0.5 border border-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isExceeded
                ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                : isWarning
                ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                : 'bg-gradient-to-r from-purple-500 to-cyan-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
          <span>0 GB</span>
          <span>{percent}% Used</span>
          <span>{formatBytes(dailyQuotaBytes)}</span>
        </div>
      </div>
    </div>
  );
};
