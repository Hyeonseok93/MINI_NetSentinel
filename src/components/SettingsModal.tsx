import React, { useState } from 'react';
import { X, Sliders, Bell, Cpu, ShieldCheck, Globe, RefreshCw, HardDrive } from 'lucide-react';
import { MonitoringConfig } from '../types/network';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MonitoringConfig;
  onSaveConfig: (newConfig: MonitoringConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [spikeThreshold, setSpikeThreshold] = useState(config.spikeThresholdPacketsPerSec);
  const [notifyNewIp, setNotifyNewIp] = useState(config.notifyOnNewIp);
  const [autoBlock, setAutoBlock] = useState(config.autoBlockSuspicious);
  const [dailyQuotaGb, setDailyQuotaGb] = useState(config.dailyQuotaGb || 10);

  const [isUpdatingGeoIp, setIsUpdatingGeoIp] = useState(false);
  const [lastGeoIpUpdated, setLastGeoIpUpdated] = useState('2026-08-10 23:23:31 (Up-to-date)');

  const handleUpdateGeoIp = () => {
    setIsUpdatingGeoIp(true);
    setTimeout(() => {
      setIsUpdatingGeoIp(false);
      const nowStr = new Date().toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastGeoIpUpdated(`${nowStr} (Up-to-date)`);
    }, 1500);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      ...config,
      spikeThresholdPacketsPerSec: spikeThreshold,
      notifyOnNewIp: notifyNewIp,
      autoBlockSuspicious: autoBlock,
      dailyQuotaGb: dailyQuotaGb,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">Sentinel Detector Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 text-xs text-slate-300">
          {/* SECTION 1: GeoIP Database Management Section */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>MaxMind GeoLite2 DB Engine</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                ACTIVE
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Last Updated Date:</span>
              <span className="text-emerald-400 font-bold">{lastGeoIpUpdated}</span>
            </div>

            <button
              onClick={handleUpdateGeoIp}
              disabled={isUpdatingGeoIp}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold transition-all flex items-center justify-center gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isUpdatingGeoIp ? 'animate-spin' : ''}`} />
              <span>{isUpdatingGeoIp ? 'Downloading Latest DB...' : '🔄 Update GeoIP DB Now'}</span>
            </button>
          </div>

          {/* SECTION 2: Adapter Interface */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1.5">
              Active Network Adapter
            </label>
            <select
              defaultValue={config.activeInterface}
              className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 font-mono"
            >
              <option value="Ethernet 0 (Intel(R) Ethernet Connection)">
                Ethernet 0 (Intel(R) Ethernet Connection)
              </option>
              <option value="Wi-Fi (Realtek 8822CE Wireless LAN)">
                Wi-Fi (Realtek 8822CE Wireless LAN)
              </option>
              <option value="Npcap Loopback Adapter">Npcap Loopback Adapter</option>
            </select>
          </div>

          {/* SECTION 3: Daily Bandwidth Quota Limit */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                Daily Bandwidth Quota Limit
              </label>
              <span className="font-mono text-amber-400 font-bold">{dailyQuotaGb} GB / Day</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={dailyQuotaGb}
              onChange={(e) => setDailyQuotaGb(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Sets daily network usage cap limit (1 GB ~ 100 GB). Triggers warnings at 80% and 100%.
            </p>
          </div>

          {/* SECTION 4: Traffic Spike Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Traffic Spike Threshold
              </label>
              <span className="font-mono text-cyan-400 font-bold">{spikeThreshold} pkts/sec</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              value={spikeThreshold}
              onChange={(e) => setSpikeThreshold(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Triggers warning when an IP exceeds this packet rate in 1 second.
            </p>
          </div>

          {/* SECTION 4: Toast Notification Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                Windows Toast Notification
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

          {/* SECTION 5: Auto Firewall Block Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                Kernel WFP Auto-Block
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Auto-block suspicious blacklisted IPs.</p>
            </div>
            <input
              type="checkbox"
              checked={autoBlock}
              onChange={(e) => setAutoBlock(e.target.checked)}
              className="w-4 h-4 accent-rose-400 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Footer with High-Visibility High-Contrast Save Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end items-center gap-3">
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
  );
};
