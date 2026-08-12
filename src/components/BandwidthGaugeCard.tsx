import React from 'react';
import { GroupedProcess, TrafficHistoryPoint } from '../types/network';
import { formatBytes } from '../utils/formatters';
import { Zap, ArrowDownCircle, ArrowUpCircle, Award } from 'lucide-react';

interface BandwidthGaugeCardProps {
  processes: GroupedProcess[];
  history: TrafficHistoryPoint[];
}

export const BandwidthGaugeCard: React.FC<BandwidthGaugeCardProps> = ({ processes, history }) => {
  const latestPoint = history.length > 0 ? history[history.length - 1] : { packetsIn: 0, packetsOut: 0, bytesSec: 0, bytesIn: 0, bytesOut: 0 };
  
  const currentRxSpeed = latestPoint.bytesIn ?? Math.floor(latestPoint.bytesSec * 0.7); // Bytes/sec
  const currentTxSpeed = latestPoint.bytesOut ?? Math.floor(latestPoint.bytesSec * 0.3); // Bytes/sec

  // Top 5 processes sorted by totalBytes
  const topProcesses = [...processes]
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 5);

  const maxBytes = topProcesses.length > 0 ? topProcesses[0].totalBytes : 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-stretch">
      {/* 1. Real-time Dual Rx/Tx Speed Gauges (5-Cols, Clean Full-Height Layout) */}
      <div className="lg:col-span-5 rounded-2xl bg-slate-950/90 border border-slate-800/80 p-5 flex flex-col justify-between shadow-xl h-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2 text-cyan-400 font-bold">
            <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>REAL-TIME DUAL BANDWIDTH GAUGE</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
            Live Telemetry
          </span>
        </div>

        {/* Download & Upload Dual Speed Cards (Filled 100% Upwards to Match Height) */}
        <div className="grid grid-cols-2 gap-4 flex-1 items-stretch">
          {/* Rx Download Speed Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-mono font-bold">
              <span className="flex items-center gap-2">
                <ArrowDownCircle className="w-4.5 h-4.5 text-emerald-400" />
                <span>DOWNLOAD (Rx)</span>
              </span>
            </div>
            
            <div className="my-auto space-y-1">
              <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300 tracking-tight">
                {formatBytes(currentRxSpeed)}
                <span className="text-xs text-slate-400 font-normal">/s</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span>{latestPoint.packetsIn} packets/s</span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                style={{ width: `${Math.min(Math.round((currentRxSpeed / (10 * 1024 * 1024)) * 100), 100)}%` }}
              />
            </div>
          </div>

          {/* Tx Upload Speed Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between text-xs text-cyan-400 font-mono font-bold">
              <span className="flex items-center gap-2">
                <ArrowUpCircle className="w-4.5 h-4.5 text-cyan-400" />
                <span>UPLOAD (Tx)</span>
              </span>
            </div>

            <div className="my-auto space-y-1">
              <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 tracking-tight">
                {formatBytes(currentTxSpeed)}
                <span className="text-xs text-slate-400 font-normal">/s</span>
              </div>
              <div className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                <span>{latestPoint.packetsOut} packets/s</span>
              </div>
            </div>

            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-cyan-400 h-full transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                style={{ width: `${Math.min(Math.round((currentTxSpeed / (5 * 1024 * 1024)) * 100), 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TOP 5 Process Traffic Ranking Chart (7-Cols, Height Matched 1:1) */}
      <div className="lg:col-span-7 rounded-2xl bg-slate-950/90 border border-slate-800/80 p-5 flex flex-col justify-between shadow-xl h-full space-y-3">
        <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2 text-purple-400 font-bold">
            <Award className="w-4 h-4 text-purple-400" />
            <span>TOP 5 BANDWIDTH CONSUMING PROCESSES</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Ranked by Volume</span>
        </div>

        <div className="flex-1 flex flex-col gap-2.5 justify-between py-1">
          {topProcesses.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              No active process traffic recorded.
            </div>
          ) : (
            topProcesses.map((proc, index) => {
              const percent = Math.min(Math.round((proc.totalBytes / maxBytes) * 100), 100);
              return (
                <div key={proc.processName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-purple-950 text-purple-300 border border-purple-800 flex items-center justify-center text-[9px] font-bold">
                        #{index + 1}
                      </span>
                      <span className="font-bold text-slate-200">{proc.processName}</span>
                      <span className="text-[9px] text-slate-500">({proc.pids.length} PIDs)</span>
                    </div>
                    <span className="font-bold text-purple-300 text-xs">{formatBytes(proc.totalBytes)}</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
