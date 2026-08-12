import React from 'react';
import { GroupedProcess, TrafficHistoryPoint } from '../types/network';
import { formatBytes } from '../utils/formatters';
import { Zap, ArrowDownCircle, ArrowUpCircle, Award, Activity, Gauge } from 'lucide-react';

interface BandwidthGaugeCardProps {
  processes: GroupedProcess[];
  history: TrafficHistoryPoint[];
}

export const BandwidthGaugeCard: React.FC<BandwidthGaugeCardProps> = ({ processes, history }) => {
  const latestPoint = history.length > 0 ? history[history.length - 1] : { packetsIn: 0, packetsOut: 0, bytesSec: 0, bytesIn: 0, bytesOut: 0 };
  
  const currentRxSpeed = latestPoint.bytesIn ?? Math.floor(latestPoint.bytesSec * 0.7); // Bytes/sec
  const currentTxSpeed = latestPoint.bytesOut ?? Math.floor(latestPoint.bytesSec * 0.3); // Bytes/sec
  const totalPktsPerSec = (latestPoint.packetsIn || 0) + (latestPoint.packetsOut || 0);

  // Top 5 processes sorted by totalBytes
  const topProcesses = [...processes]
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 5);

  const maxBytes = topProcesses.length > 0 ? topProcesses[0].totalBytes : 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-stretch">
      {/* 1. Real-time Dual Rx/Tx Speed Gauges (5-Cols, Height Matched 1:1) */}
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

        {/* Top Filled Accent Area: Live Packet Rate & Mini Sparkline Wave (Eliminating Empty Space) */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Packet Throughput:</span>
            </div>
            <span className="font-bold text-cyan-300">{totalPktsPerSec} pkts/s</span>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Gauge className="w-3.5 h-3.5 text-purple-400" />
              <span>Combined Total Speed:</span>
            </div>
            <span className="font-bold text-purple-300">{formatBytes(currentRxSpeed + currentTxSpeed)}/s</span>
          </div>

          {/* Mini Cyber Sine Wave Graphic Bar */}
          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden flex items-center gap-0.5 p-0.5 border border-slate-800">
            <div className="h-full bg-cyan-400 rounded-full animate-pulse" style={{ width: '25%' }} />
            <div className="h-full bg-emerald-400 rounded-full animate-pulse" style={{ width: '40%' }} />
            <div className="h-full bg-purple-400 rounded-full animate-pulse" style={{ width: '35%' }} />
          </div>
        </div>

        {/* Download & Upload Dual Speed Cards */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {/* Rx Download Speed Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-mono font-bold">
              <span className="flex items-center gap-1.5">
                <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
                <span>DOWNLOAD (Rx)</span>
              </span>
            </div>
            <div>
              <div className="text-xl font-black font-mono text-emerald-300">
                {formatBytes(currentRxSpeed)}
                <span className="text-xs text-slate-400 font-normal">/s</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                {latestPoint.packetsIn} packets/s
              </div>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-400 h-full transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                style={{ width: `${Math.min(Math.round((currentRxSpeed / (10 * 1024 * 1024)) * 100), 100)}%` }}
              />
            </div>
          </div>

          {/* Tx Upload Speed Card */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-cyan-400 font-mono font-bold">
              <span className="flex items-center gap-1.5">
                <ArrowUpCircle className="w-4 h-4 text-cyan-400" />
                <span>UPLOAD (Tx)</span>
              </span>
            </div>
            <div>
              <div className="text-xl font-black font-mono text-cyan-300">
                {formatBytes(currentTxSpeed)}
                <span className="text-xs text-slate-400 font-normal">/s</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                {latestPoint.packetsOut} packets/s
              </div>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
              <div
                className="bg-cyan-400 h-full transition-all duration-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
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
