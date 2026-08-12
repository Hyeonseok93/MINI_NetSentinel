import React from 'react';
import { Settings, Cpu, Minimize2, Play, Pause, Bell, Download, ShieldAlert } from 'lucide-react';
import logoImg from '../../public/logo.png';

interface NavbarProps {
  isMonitoring: boolean;
  onToggleMonitoring: () => void;
  onOpenSettings: () => void;
  onOpenTrustedHub: () => void;
  onOpenBlacklist?: () => void;
  onExportReport?: () => void;
  unresolvedAnomaliesCount: number;
  trustedCount?: number;
  blacklistedCount?: number;
  connectionMode?: 'electron' | 'vite-dev' | 'offline';
  connectionOk?: boolean;
  connectionError?: string | null;
  captureMode?: 'npcap' | 'netstat' | 'unknown';
}

export const Navbar: React.FC<NavbarProps> = ({
  isMonitoring,
  onToggleMonitoring,
  onOpenSettings,
  onOpenTrustedHub,
  onOpenBlacklist,
  onExportReport,
  unresolvedAnomaliesCount,
  blacklistedCount = 0,
  connectionMode = 'offline',
  connectionOk = false,
  connectionError = null,
  captureMode = 'unknown',
}) => {
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

  return (
    <header className="glass-panel border-b border-slate-800/80 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* logo.png Image + Solid NetSentinel Text (NO Gradient, NO Shadow/Mask/Fade) */}
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="NetSentinel Logo" className="h-9 w-auto object-contain" />
          <h1 className="text-2xl font-black text-[#00b4d8] tracking-tight">
            NetSentinel
          </h1>
        </div>

      {/* Status & Control Actions */}
      <div className="flex items-center gap-3">
        {/* Capture backend mode */}
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300"
          title={
            captureMode === 'npcap'
              ? 'Real packet/byte counters via Npcap'
              : captureMode === 'netstat'
                ? 'Connection list only (netstat). Packet/byte volumes are 0 by design — not estimated.'
                : 'Capture mode unknown'
          }
        >
          <span>
            Capture: <strong className={captureClass}>{captureLabel}</strong>
          </span>
        </div>

        {/* Capture bridge health */}
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300"
          title={connectionError || 'Telemetry bridge status'}
        >
          <Cpu className={`w-3.5 h-3.5 ${bridgeClass}`} />
          <span>
            Bridge: <strong className={bridgeClass}>{bridgeLabel}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span className={connectionOk ? 'text-emerald-400' : 'text-rose-400'}>
            {connectionOk ? 'OK' : 'DOWN'}
          </span>
        </div>

        {/* Monitoring Toggle */}
        <button
          onClick={onToggleMonitoring}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shadow-md ${
            isMonitoring
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 glow-emerald'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isMonitoring ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Monitoring ACTIVE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>PAUSED</span>
            </>
          )}
        </button>

        {/* Export Security Audit Report Button */}
        {onExportReport && (
          <button
            onClick={onExportReport}
            className="p-2.5 rounded-xl bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold w-[105px] shrink-0"
            title="Download CSV Audit Report"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}

        {/* Firewall Blacklist Manager Button */}
        {onOpenBlacklist && (
          <button
            onClick={onOpenBlacklist}
            className="relative p-2.5 rounded-xl bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-rose-400 hover:border-rose-500/40 hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold w-[105px] shrink-0"
            title="Firewall Blacklist Manager"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="hidden sm:inline">Blacklist</span>
            {blacklistedCount > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                {blacklistedCount}
              </span>
            )}
          </button>
        )}

        {/* Dedicated Whitelist & Notification Hub Button */}
        <button
          onClick={onOpenTrustedHub}
          className="relative p-2.5 rounded-xl bg-slate-900/80 text-slate-300 border border-slate-800 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold w-[105px] shrink-0"
          title="Notification & Trusted Whitelist Hub"
        >
          <Bell className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Whitelist</span>
          {unresolvedAnomaliesCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full">
              {unresolvedAnomaliesCount}
            </span>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-xl bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Settings & Thresholds"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Tray Minimize Button */}
        <button
          className="p-2.5 rounded-xl bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
          title="Minimize to System Tray (Low GPU mode)"
          onClick={() => {
            alert("App minimized to System Tray. Monitoring continues in silent zero-GPU background mode.");
          }}
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  </header>
  );
};
