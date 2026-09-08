import React from 'react';
import {
  ArrowDownToLine,
  Maximize2,
  X,
  Activity,
  ShieldAlert,
  ArrowDownCircle,
  ArrowUpCircle,
  PanelTop,
  Zap,
  Gauge,
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { invokeElectron } from '../utils/electronIpc';
import type { TrafficHistoryPoint } from '../types/network';
import type { IpcChannel } from '../ipc/channels';

const SPARK_POINTS = 28;

function buildSparkPaths(values: number[], w = 56, h = 22, pad = 1) {
  const pts = values.length > 0 ? values : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = Math.max(max - min, 1);
  const step = pts.length > 1 ? (w - pad * 2) / (pts.length - 1) : 0;

  const coords = pts.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = coords.join(' ');
  const first = coords[0] ?? `${pad},${h - pad}`;
  const last = coords[coords.length - 1] ?? `${w - pad},${h - pad}`;
  const area = `${first} ${line} ${last.split(',')[0]},${h - pad} ${pad},${h - pad}`;
  return { line, area, w, h };
}

function MiniSparkline({
  values,
  stroke,
  fill,
}: {
  values: number[];
  stroke: string;
  fill: string;
}) {
  const { line, area, w, h } = buildSparkPaths(values);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <polygon points={area} fill={fill} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface FloatingHudProps {
  isMonitoring: boolean;
  sessionCount: number;
  anomalyCount: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  history?: TrafficHistoryPoint[];
  captureMode?: 'npcap' | 'netstat' | 'unknown';
  connectionOk?: boolean;
  topProcessName?: string | null;
  topProcessBytes?: number;
  topIp?: string | null;
  topIpBytes?: number;
  currentBytesToday?: number;
  dailyQuotaBytes?: number;
  onExpand: () => void;
  onToggleMonitoring: () => void;
}

export const FloatingHud: React.FC<FloatingHudProps> = ({
  isMonitoring,
  sessionCount,
  anomalyCount,
  rxBytesPerSec,
  txBytesPerSec,
  history = [],
  captureMode = 'unknown',
  connectionOk = false,
  topProcessName = null,
  topProcessBytes = 0,
  topIp = null,
  topIpBytes = 0,
  currentBytesToday = 0,
  dailyQuotaBytes = 1,
  onExpand,
  onToggleMonitoring,
}) => {
  const captureLabel = captureMode === 'npcap' ? 'Npcap' : captureMode === 'netstat' ? 'Netstat' : '—';

  const slice = history.slice(-SPARK_POINTS);
  const rxSeries = slice.map((p) => p.bytesIn ?? 0);
  const txSeries = slice.map((p) => p.bytesOut ?? 0);
  while (rxSeries.length < 2) rxSeries.push(rxSeries[0] ?? 0);
  while (txSeries.length < 2) txSeries.push(txSeries[0] ?? 0);

  const quotaSafe = Math.max(1, dailyQuotaBytes);
  const quotaPercent = Math.min(100, Math.round((currentBytesToday / quotaSafe) * 100));
  const isQuotaWarning = quotaPercent >= 80;
  const isQuotaExceeded = quotaPercent >= 100;

  const talkerProcess = topProcessName
    ? `${topProcessName} · ${formatBytes(topProcessBytes)}`
    : 'No active process';
  const talkerIp = topIp ? `${topIp} · ${formatBytes(topIpBytes)}` : 'No active IP';

  const winInvoke = (channel: IpcChannel) => {
    invokeElectron(channel).catch(() => {});
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col select-none border border-slate-800">
      <div className="titlebar-drag h-9 flex items-center justify-between px-2 border-b border-slate-800/90 bg-slate-950/95 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 pl-1">
          <PanelTop className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-[12px] font-semibold text-slate-100 truncate">NetSentinel</span>
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Float</span>
        </div>
        <div className="titlebar-no-drag flex items-stretch h-7">
          <button
            type="button"
            onClick={onExpand}
            className="w-8 flex items-center justify-center text-slate-400 hover:bg-cyan-950/80 hover:text-cyan-300 transition-colors"
            title="Expand to full window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => winInvoke('window-minimize-to-tray')}
            className="w-8 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            title="Minimize to tray"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => winInvoke('window-close')}
            className="w-8 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-3 pt-3 pb-3.5 flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-[10px] font-mono min-w-0">
            <span className={`inline-flex items-center gap-1 ${connectionOk ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connectionOk ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {connectionOk ? 'Live' : 'Offline'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">{captureLabel}</span>
          </div>
          <button
            type="button"
            onClick={onToggleMonitoring}
            className={`titlebar-no-drag px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors shrink-0 ${
              isMonitoring
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {isMonitoring ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-[1.4] min-h-0">
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2 flex flex-col justify-center min-w-0 min-h-0">
            <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono mb-1">
              <ArrowDownCircle className="w-3 h-3 shrink-0" />
              RX
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-[13px] font-bold font-mono text-slate-100 tabular-nums leading-none truncate min-w-0">
                {formatBytes(rxBytesPerSec)}
                <span className="text-[10px] text-slate-500 font-medium">/s</span>
              </p>
              <MiniSparkline values={rxSeries} stroke="#34d399" fill="rgba(52, 211, 153, 0.15)" />
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2 flex flex-col justify-center min-w-0 min-h-0">
            <div className="flex items-center gap-1 text-[9px] text-sky-400 font-mono mb-1">
              <ArrowUpCircle className="w-3 h-3 shrink-0" />
              TX
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <p className="text-[13px] font-bold font-mono text-slate-100 tabular-nums leading-none truncate min-w-0">
                {formatBytes(txBytesPerSec)}
                <span className="text-[10px] text-slate-500 font-medium">/s</span>
              </p>
              <MiniSparkline values={txSeries} stroke="#38bdf8" fill="rgba(56, 189, 248, 0.15)" />
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2 flex flex-col justify-center min-h-0">
            <div className="flex items-center gap-1 text-[9px] text-cyan-400 font-mono mb-0.5">
              <Activity className="w-3 h-3" />
              Sessions
            </div>
            <p className="text-sm font-bold font-mono text-slate-100 tabular-nums">{sessionCount}</p>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2 flex flex-col justify-center min-h-0">
            <div className="flex items-center gap-1 text-[9px] text-rose-400 font-mono mb-0.5">
              <ShieldAlert className="w-3 h-3" />
              Events
            </div>
            <p
              className={`text-sm font-bold font-mono tabular-nums ${
                anomalyCount > 0 ? 'text-rose-300' : 'text-slate-100'
              }`}
            >
              {anomalyCount}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2 flex-1 min-h-0 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1 text-[9px] text-amber-400 font-mono mb-1">
            <Zap className="w-3 h-3 shrink-0" />
            Top talker
          </div>
          <p className="text-[11px] font-mono text-slate-100 truncate pr-0.5" title={talkerProcess}>
            {talkerProcess}
          </p>
          <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5 pr-0.5" title={talkerIp}>
            {talkerIp}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/80 border border-slate-800 px-2.5 py-2 flex-1 min-h-0 min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1 text-[9px] text-violet-400 font-mono min-w-0">
              <Gauge className="w-3 h-3 shrink-0" />
              Daily quota
            </div>
            <span
              className={`text-[10px] font-mono font-bold tabular-nums shrink-0 ${
                isQuotaExceeded
                  ? 'text-rose-400'
                  : isQuotaWarning
                    ? 'text-amber-300'
                    : 'text-slate-300'
              }`}
            >
              {quotaPercent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                isQuotaExceeded
                  ? 'bg-rose-500'
                  : isQuotaWarning
                    ? 'bg-amber-400'
                    : 'bg-violet-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-slate-500 tabular-nums truncate">
            {formatBytes(currentBytesToday)}
            <span className="text-slate-600"> / </span>
            {formatBytes(dailyQuotaBytes)}
          </p>
        </div>
      </div>
    </div>
  );
};
