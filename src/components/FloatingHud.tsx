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
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { getElectronIpc } from '../utils/electronIpc';

interface FloatingHudProps {
  isMonitoring: boolean;
  sessionCount: number;
  anomalyCount: number;
  rxBytesPerSec: number;
  txBytesPerSec: number;
  captureMode?: 'npcap' | 'netstat' | 'unknown';
  connectionOk?: boolean;
  onExpand: () => void;
  onToggleMonitoring: () => void;
}

export const FloatingHud: React.FC<FloatingHudProps> = ({
  isMonitoring,
  sessionCount,
  anomalyCount,
  rxBytesPerSec,
  txBytesPerSec,
  captureMode = 'unknown',
  connectionOk = false,
  onExpand,
  onToggleMonitoring,
}) => {
  const ipc = getElectronIpc();
  const captureLabel = captureMode === 'npcap' ? 'Npcap' : captureMode === 'netstat' ? 'Netstat' : '—';

  const winInvoke = (channel: string) => {
    ipc?.invoke(channel).catch(() => {});
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

      <div className="flex-1 min-h-0 p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-mono">
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
            className={`titlebar-no-drag px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
              isMonitoring
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {isMonitoring ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono mb-1">
              <ArrowDownCircle className="w-3 h-3" />
              RX
            </div>
            <p className="text-sm font-bold font-mono text-slate-100 tabular-nums">
              {formatBytes(rxBytesPerSec)}
              <span className="text-[10px] text-slate-500 font-medium">/s</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[9px] text-sky-400 font-mono mb-1">
              <ArrowUpCircle className="w-3 h-3" />
              TX
            </div>
            <p className="text-sm font-bold font-mono text-slate-100 tabular-nums">
              {formatBytes(txBytesPerSec)}
              <span className="text-[10px] text-slate-500 font-medium">/s</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[9px] text-cyan-400 font-mono mb-1">
              <Activity className="w-3 h-3" />
              Sessions
            </div>
            <p className="text-sm font-bold font-mono text-slate-100 tabular-nums">{sessionCount}</p>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 flex flex-col justify-center">
            <div className="flex items-center gap-1 text-[9px] text-rose-400 font-mono mb-1">
              <ShieldAlert className="w-3 h-3" />
              Alerts
            </div>
            <p className="text-sm font-bold font-mono text-slate-100 tabular-nums">{anomalyCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
