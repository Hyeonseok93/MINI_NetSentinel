import React, { useEffect, useState } from 'react';
import {
  Settings,
  Cpu,
  Minimize2,
  Maximize2,
  X,
  Play,
  Pause,
  Download,
  ShieldAlert,
  ShieldCheck,
  ArrowDownToLine,
  PanelTop,
} from 'lucide-react';
import logoImg from '../../public/logo.png';
import { getElectronIpc } from '../utils/electronIpc';
import { RestoreIcon } from './icons/RestoreIcon';

interface NavbarProps {
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onOpenSettings: () => void;
  onOpenTrustedHub: () => void;
  onOpenBlacklist?: () => void;
  onExportReport?: () => void;
  trustedCount?: number;
  blacklistedCount?: number;
  connectionMode?: 'electron' | 'vite-dev' | 'offline';
  connectionOk?: boolean;
  connectionError?: string | null;
  captureMode?: 'npcap' | 'netstat' | 'unknown';
  onEnterFloat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isMonitoring,
  onToggleMonitoring,
  onOpenSettings,
  onOpenTrustedHub,
  onOpenBlacklist,
  onExportReport,
  blacklistedCount = 0,
  connectionMode = 'offline',
  connectionOk = false,
  connectionError = null,
  captureMode = 'unknown',
  onEnterFloat,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const hasWindowControls = connectionMode === 'electron' || !!getElectronIpc();

  useEffect(() => {
    const ipc = getElectronIpc();
    if (!ipc) return;
    ipc
      .invoke('window-is-maximized')
      .then((r: { maximized?: boolean }) => {
        setIsMaximized(!!r?.maximized);
      })
      .catch(() => {});

    if (!ipc.onWindowState) return;
    return ipc.onWindowState((state) => {
      if (typeof state?.maximized === 'boolean') setIsMaximized(state.maximized);
    });
  }, []);

  const bridgeLabel =
    connectionMode === 'electron' ? 'Electron' : connectionMode === 'vite-dev' ? 'Vite Dev' : 'No Bridge';
  const bridgeClass = connectionOk
    ? 'text-emerald-400'
    : connectionMode === 'offline'
      ? 'text-rose-400'
      : 'text-amber-400';
  const captureLabel = captureMode === 'npcap' ? 'Npcap' : captureMode === 'netstat' ? 'Netstat' : '—';
  const captureClass =
    captureMode === 'npcap' ? 'text-cyan-400' : captureMode === 'netstat' ? 'text-amber-400' : 'text-slate-500';

  const winInvoke = (channel: string) => {
    const ipc = getElectronIpc();
    if (!ipc) return;
    ipc.invoke(channel).then((r: { maximized?: boolean }) => {
      if (channel === 'window-maximize-toggle' && typeof r?.maximized === 'boolean') {
        setIsMaximized(r.maximized);
      }
    }).catch(() => {});
  };

  return (
    <header className="shrink-0 z-40 border-b border-slate-800/90 bg-slate-950/95 select-none">
      <div
        className="titlebar-drag h-12 flex items-center justify-between pl-3 pr-1"
        onDoubleClick={() => hasWindowControls && winInvoke('window-maximize-toggle')}
      >
        {/* Brand (draggable) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={logoImg} alt="NetSentinel Logo" className="h-7 w-auto object-contain pointer-events-none" />
          <div className="leading-tight min-w-0">
            <h1 className="text-[15px] font-bold text-slate-100 tracking-tight truncate">
              NetSentinel
            </h1>
            <p className="text-[10px] text-slate-500 font-mono truncate">Enterprise Monitor</p>
          </div>
        </div>

        {/* Controls — no-drag so clicks work */}
        <div className="titlebar-no-drag flex items-center gap-1.5 sm:gap-2">
          <div
            className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400"
            title={
              captureMode === 'npcap'
                ? 'Real packet/byte counters via Npcap'
                : captureMode === 'netstat'
                  ? 'Connection list only (netstat). Packet/byte volumes are 0 by design — not estimated.'
                  : 'Capture mode unknown'
            }
          >
            <span>
              Capture <strong className={captureClass}>{captureLabel}</strong>
            </span>
          </div>

          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-400"
            title={connectionError || 'Telemetry bridge status'}
          >
            <Cpu className={`w-3 h-3 ${bridgeClass}`} />
            <span>
              <strong className={bridgeClass}>{bridgeLabel}</strong>
            </span>
            <span className="text-slate-700">·</span>
            <span className={connectionOk ? 'text-emerald-400' : 'text-rose-400'}>
              {connectionOk ? 'OK' : 'DOWN'}
            </span>
          </div>

          <button
            onClick={onToggleMonitoring}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
              isMonitoring
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isMonitoring ? (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">ACTIVE</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">PAUSED</span>
              </>
            )}
          </button>

          {onExportReport && (
            <button
              onClick={onExportReport}
              className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
              title="Download CSV Audit Report"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}

          {onOpenBlacklist && (
            <button
              onClick={onOpenBlacklist}
              className="relative p-1.5 rounded-md bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
              title="Firewall Blacklist Manager"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              {blacklistedCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 text-[9px] font-bold rounded-full bg-rose-600 text-white flex items-center justify-center">
                  {blacklistedCount > 99 ? '99+' : blacklistedCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={onOpenTrustedHub}
            className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 border border-slate-800 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
            title="Trusted Whitelist Hub"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-100 transition-colors"
            title="Settings & Thresholds"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {hasWindowControls && (
            <div className="flex items-stretch ml-1 pl-1 border-l border-slate-800 h-8">
              <button
                type="button"
                onClick={() => winInvoke('window-minimize-to-tray')}
                className="w-11 flex items-center justify-center text-slate-400 hover:bg-cyan-950/80 hover:text-cyan-300 transition-colors"
                title="Minimize to system tray (keep monitoring)"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onEnterFloat?.()}
                className="w-11 flex items-center justify-center text-slate-400 hover:bg-violet-950/70 hover:text-violet-300 transition-colors"
                title="Floating mini HUD (minimal stats)"
              >
                <PanelTop className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => winInvoke('window-minimize')}
                className="w-11 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => winInvoke('window-maximize-toggle')}
                className="w-11 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <RestoreIcon className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => winInvoke('window-close')}
                className="w-11 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
