import React, { useState } from 'react';
import { X, Sliders, Bell, Cpu, ShieldCheck } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      ...config,
      spikeThresholdPacketsPerSec: spikeThreshold,
      notifyOnNewIp: notifyNewIp,
      autoBlockSuspicious: autoBlock,
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

        {/* Content */}
        <div className="p-5 space-y-5 text-xs text-slate-300">
          {/* Traffic Spike Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
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

          {/* Toast Notification Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                Windows Toast Notification
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Show system popup when unrecognized IP connects
              </p>
            </div>
            <input
              type="checkbox"
              checked={notifyNewIp}
              onChange={(e) => setNotifyNewIp(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Auto-Block Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Auto-Flag Suspicious Blacklist GEOs
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically mark high-risk GEO nodes as suspicious
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoBlock}
              onChange={(e) => setAutoBlock(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Adapter Interface */}
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 hover:brightness-110 transition-all shadow-md"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
