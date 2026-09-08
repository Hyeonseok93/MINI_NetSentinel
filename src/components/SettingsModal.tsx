import React, { useState, useEffect } from 'react';
import { X, Sliders, Bell, Cpu, Globe, RefreshCw, HardDrive, ChevronDown, RotateCcw, History } from 'lucide-react';
import { MonitoringConfig } from '../types/network';
import { getElectronIpc, isElectronShell } from '../utils/electronIpc';
import { askConfirm } from '../ui/confirmBus';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MonitoringConfig;
  onSaveConfig: (newConfig: MonitoringConfig) => void;
  onResetToDefaults: () => void | Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetToDefaults,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [spikeThreshold, setSpikeThreshold] = useState(config.spikeThresholdPacketsPerSec);
  const [historySpikeThreshold, setHistorySpikeThreshold] = useState(
    config.historySpikePacketsPerSec ?? 200
  );
  const [notifyNewIp, setNotifyNewIp] = useState(config.notifyOnNewIp);
  const [dailyQuotaValue, setDailyQuotaValue] = useState(config.dailyQuotaValue || 10);
  const [dailyQuotaUnit, setDailyQuotaUnit] = useState<'KB' | 'MB' | 'GB' | 'TB'>(config.dailyQuotaUnit || 'GB');
  const [activeInterface, setActiveInterface] = useState(config.activeInterface || '');
  const [adapters, setAdapters] = useState<Array<{ name: string; description: string }>>([]);

  const [isUpdatingGeoIp, setIsUpdatingGeoIp] = useState(false);
  const [lastGeoIpUpdated, setLastGeoIpUpdated] = useState('Checking GeoIP DB...');
  const [geoIpError, setGeoIpError] = useState<string | null>(null);
  const [geoIpActive, setGeoIpActive] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSpikeThreshold(config.spikeThresholdPacketsPerSec);
    setHistorySpikeThreshold(config.historySpikePacketsPerSec ?? 200);
    setNotifyNewIp(config.notifyOnNewIp);
    setDailyQuotaValue(config.dailyQuotaValue || 10);
    setDailyQuotaUnit(config.dailyQuotaUnit || 'GB');
    setActiveInterface(config.activeInterface || '');

    const ipc = getElectronIpc();
    if (!ipc) {
      if (isElectronShell()) {
        setLastGeoIpUpdated('IPC bridge missing — rebuild with npm run build:exe');
        setGeoIpError('Electron preload bridge unavailable');
        setGeoIpActive(false);
      } else {
        setLastGeoIpUpdated('GeoIP unavailable (not running in Electron)');
        setGeoIpError(null);
      }
      setAdapters([]);
      return;
    }
    ipc
      .invoke('geoip-status')
      .then((status: { label?: string; active?: boolean }) => {
        setLastGeoIpUpdated(status?.label || 'Unknown');
        setGeoIpActive(Boolean(status?.active));
        setGeoIpError(status?.active ? null : 'DB not loaded');
      })
      .catch(() => setLastGeoIpUpdated('Failed to read GeoIP status'));

    ipc
      .invoke('list-capture-adapters')
      .then((list: Array<{ name: string; description: string }>) => {
        if (Array.isArray(list)) {
          setAdapters(list);
          setActiveInterface((current) => current || list[0]?.name || '');
        }
      })
      .catch(() => setAdapters([]));
  }, [isOpen, config]);

  const handleUpdateGeoIp = async () => {
    const ipc = getElectronIpc();
    if (!ipc) {
      setGeoIpError(
        isElectronShell()
          ? 'IPC bridge missing — rebuild with npm run build:exe'
          : 'Electron IPC unavailable'
      );
      return;
    }

    setIsUpdatingGeoIp(true);
    setGeoIpError(null);
    try {
      const status = await ipc.invoke('geoip-update');
      setLastGeoIpUpdated(status?.label || 'Updated');
      setGeoIpActive(Boolean(status?.active));
      if (!status?.active) {
        setGeoIpError('Download finished but DB failed to open');
      }
    } catch (err: any) {
      setGeoIpError(err?.message || 'GeoIP download failed');
    } finally {
      setIsUpdatingGeoIp(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      ...config,
      spikeThresholdPacketsPerSec: Math.max(1, Math.floor(spikeThreshold) || 40),
      historySpikePacketsPerSec: Math.max(1, Math.floor(historySpikeThreshold) || 200),
      notifyOnNewIp: notifyNewIp,
      activeInterface: activeInterface || config.activeInterface,
      dailyQuotaValue: Math.max(1, dailyQuotaValue || 1),
      dailyQuotaUnit: dailyQuotaUnit,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-slate-950/80 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-3 sm:p-4 sm:items-center">
        <div
          className="glass-panel w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ maxHeight: 'calc(100vh - 1.5rem)' }}
        >
          {/* Header — always visible */}
          <div className="shrink-0 p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
            <div className="flex items-center gap-2 min-w-0">
              <Sliders className="w-4 h-4 text-cyan-400 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-100 truncate">Sentinel Detector Settings</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Close settings"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body scrolls inside modal */}
          <div className="p-5 space-y-5 text-xs text-slate-300 overflow-y-auto overflow-x-hidden flex-1 min-h-0 custom-scrollbar">
          {/* SECTION 1: GeoIP Database Management Section */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>MaxMind GeoLite2 country DB</span>
              </div>
              <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full border ${
                geoIpActive
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border-rose-800'
              }`}>
                {geoIpActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-[11px] font-mono">
              <span className="text-slate-400">Last Updated Date:</span>
              <span className="text-emerald-400 font-bold whitespace-nowrap overflow-x-auto">
                {lastGeoIpUpdated}
              </span>
            </div>

            {geoIpError && (
              <p className="text-[10px] text-amber-400 font-mono">{geoIpError}</p>
            )}

            <button
              onClick={handleUpdateGeoIp}
              disabled={isUpdatingGeoIp}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isUpdatingGeoIp ? 'animate-spin' : ''}`} />
              <span>{isUpdatingGeoIp ? 'Downloading Latest DB...' : 'Update GeoIP DB Now'}</span>
            </button>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              This product includes GeoLite2 data created by MaxMind, available from{' '}
              <button
                type="button"
                className="text-cyan-400/90 underline underline-offset-2"
                onClick={() => {
                  const ipc = getElectronIpc();
                  if (ipc) void ipc.invoke('open-external-url', 'https://www.maxmind.com');
                }}
              >
                maxmind.com
              </button>
              . Checksums verified on download; see README for redistribution notes.
            </p>
          </div>

          {/* SECTION 2: Adapter Interface */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1.5">
              Active Network Adapter (Npcap)
            </label>
            <div className="relative">
              <select
                value={activeInterface}
                onChange={(e) => setActiveInterface(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono appearance-none cursor-pointer"
              >
                {adapters.length === 0 && (
                  <option value={activeInterface || ''}>
                    {activeInterface || 'No Npcap adapters detected'}
                  </option>
                )}
                {adapters.map((adapter) => (
                  <option key={adapter.name} value={adapter.name}>
                    {adapter.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Changes which NIC Npcap listens on. Netstat connection list is system-wide.
              {!adapters.length ? (
                <>
                  {' '}
                  No Npcap adapters? Install from{' '}
                  <a
                    href="https://npcap.com/#download"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      const ipc = getElectronIpc();
                      if (ipc?.invoke) {
                        ipc.invoke('open-external-url', 'https://npcap.com/#download').catch(() => {
                          window.open('https://npcap.com/#download', '_blank');
                        });
                      } else {
                        window.open('https://npcap.com/#download', '_blank');
                      }
                    }}
                  >
                    npcap.com/#download
                  </a>
                  .
                </>
              ) : null}
            </p>
          </div>

          {/* SECTION 3: Daily Bandwidth Quota Limit */}
          <div>
            <label className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              Daily Bandwidth Quota Limit
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="any"
                inputMode="decimal"
                value={dailyQuotaValue}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDailyQuotaValue(Number.isFinite(n) ? n : 1);
                }}
                className="no-spinner flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500/50"
                placeholder="Enter quota limit..."
              />
              <div className="relative">
                <select
                  value={dailyQuotaUnit}
                  onChange={(e) => setDailyQuotaUnit(e.target.value as 'KB' | 'MB' | 'GB' | 'TB')}
                  className="pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-200 focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                >
                  <option value="KB">KB / Day</option>
                  <option value="MB">MB / Day</option>
                  <option value="GB">GB / Day</option>
                  <option value="TB">TB / Day</option>
                </select>
                <ChevronDown className="w-4 h-4 text-amber-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Specify exact daily network usage limit and unit (B, KB, MB, GB, TB).
            </p>
          </div>

          {/* Traffic Spike — direct input */}
          <div>
            <label className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Traffic Spike Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100000"
                step="1"
                inputMode="numeric"
                value={spikeThreshold}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  setSpikeThreshold(Number.isFinite(n) ? Math.max(1, n) : 1);
                }}
                className="no-spinner flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500/50"
              />
              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">pkts/sec</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Triggers Anomaly warning when a single IP exceeds this packet rate in 1 second.
            </p>
          </div>

          {/* History Spike — direct input */}
          <div>
            <label className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
              <History className="w-3.5 h-3.5 text-amber-400" />
              History Spike Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1000000"
                step="1"
                inputMode="numeric"
                value={historySpikeThreshold}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value));
                  setHistorySpikeThreshold(Number.isFinite(n) ? Math.max(1, n) : 1);
                }}
                className="no-spinner flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500/50"
              />
              <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">pkts/sec</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Records a History snapshot when total chart traffic (all IPs) reaches this rate, or ~2.5× the recent average.
            </p>
          </div>

          {/* SECTION 4: Toast Notification Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                In-App Toast Notification
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Alert on new unrecognized IP connections.</p>
            </div>
            <input
              type="checkbox"
              checked={notifyNewIp}
              onChange={(e) => setNotifyNewIp(e.target.checked)}
              className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
            />
          </div>

          </div>

          {/* Footer — always visible */}
          <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900/95 flex justify-between items-center gap-3">
          <button
            type="button"
            disabled={isResetting}
            onClick={async () => {
              const ok = await askConfirm({
                title: 'Reset everything to defaults?',
                message:
                  '• Settings → factory defaults (new-IP toasts OFF)\n' +
                  '• Verified / Trusted / Blocked → cleared (built-in trusted kept)\n' +
                  '• Anomalies & traffic totals → cleared\n' +
                  '• IPs will be re-learned as NEW',
                detail: 'Firewall block rules will be removed for app-blocked IPs.',
                confirmLabel: 'Reset All',
                cancelLabel: 'Cancel',
                tone: 'danger',
              });
              if (!ok) return;
              setIsResetting(true);
              try {
                await onResetToDefaults();
              } finally {
                setIsResetting(false);
              }
            }}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-amber-200 hover:text-amber-100 bg-amber-950/40 hover:bg-amber-900/50 transition-all border border-amber-800/60 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Resetting…' : 'Reset All'}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-all shadow-[0_0_15px_rgba(34,211,238,0.8)] border border-cyan-300 cursor-pointer"
            >
              Save Configuration
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-all border border-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
