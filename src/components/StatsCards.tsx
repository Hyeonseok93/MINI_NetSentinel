import React from 'react';
import { formatBytes } from '../utils/formatters';
import { Network, Activity, HardDriveDownload, AlertTriangle } from 'lucide-react';

interface StatsCardsProps {
  totalIps: number;
  totalPackets: number;
  totalBytes: number;
  anomaliesCount: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  totalIps,
  totalPackets,
  totalBytes,
  anomaliesCount,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
      {/* Active Remote IPs */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-slate-800/80 hover:border-cyan-500/30 transition-all duration-300">
        <div>
          <p className="text-xs font-medium text-slate-400">Connected Remote IPs</p>
          <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{totalIps}</p>
          <p className="text-[11px] text-cyan-400 mt-1">Live active sessions</p>
        </div>
        <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
          <Network className="w-6 h-6" />
        </div>
      </div>

      {/* Total Packets */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-slate-800/80 hover:border-emerald-500/30 transition-all duration-300">
        <div>
          <p className="text-xs font-medium text-slate-400">Total Packets Processed</p>
          <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{totalPackets.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-400 mt-1">Zero-copy aggregation</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
          <Activity className="w-6 h-6" />
        </div>
      </div>

      {/* Data Transferred */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-slate-800/80 hover:border-teal-500/30 transition-all duration-300">
        <div>
          <p className="text-xs font-medium text-slate-400">Aggregated Traffic Volume</p>
          <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{formatBytes(totalBytes)}</p>
          <p className="text-[11px] text-teal-400 mt-1">Inbound / Outbound sum</p>
        </div>
        <div className="p-3 rounded-xl bg-teal-950/60 border border-teal-800/50 text-teal-400">
          <HardDriveDownload className="w-6 h-6" />
        </div>
      </div>

      {/* Anomalies Detected */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between border border-slate-800/80 hover:border-rose-500/30 transition-all duration-300">
        <div>
          <p className="text-xs font-medium text-slate-400">Open events</p>
          <p className="text-2xl font-bold text-rose-400 mt-1 font-mono">{anomaliesCount}</p>
          <p className="text-[11px] text-rose-400 mt-1">
            {anomaliesCount > 0 ? 'Unresolved log entries' : 'None open'}
          </p>
        </div>
        <div className={`p-3 rounded-xl border ${anomaliesCount > 0 ? 'bg-rose-950/60 border-rose-800/60 text-rose-400 glow-rose' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
          <AlertTriangle className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
