import React, { useState } from 'react';
import { X, ShieldAlert, Trash2, Plus, Lock, AlertTriangle, RotateCcw } from 'lucide-react';
import { BlacklistedIpItem } from '../types/network';
import { normalizeIpv4 } from '../utils/ip';

interface BlacklistManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  blacklistedIps: BlacklistedIpItem[];
  onUnblockIp: (ip: string) => void;
  onAddBlockIp: (ip: string, reason: string) => void;
  onResetBlacklist: () => void | Promise<void>;
}

export const BlacklistManagerModal: React.FC<BlacklistManagerModalProps> = ({
  isOpen,
  onClose,
  blacklistedIps,
  onUnblockIp,
  onAddBlockIp,
  onResetBlacklist,
}) => {
  const [manualIp, setManualIp] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [ipError, setIpError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeIp = normalizeIpv4(manualIp);
    if (!safeIp) {
      setIpError('Enter a valid IPv4 address (e.g. 185.220.101.5)');
      return;
    }
    setIpError(null);
    onAddBlockIp(safeIp, manualReason.trim().slice(0, 120) || 'Manual Security Block');
    setManualIp('');
    setManualReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-rose-800/80 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-rose-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <span>Firewall Blacklist Manager</span>
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                  {blacklistedIps.length} Blocked
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Manage blocked IP addresses and security firewall drop rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Manual Add Block Form */}
        <form onSubmit={handleAddSubmit} className="p-4 border-b border-slate-800/80 bg-slate-950/50 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="IP Address (e.g. 185.220.101.5)"
              value={manualIp}
              onChange={(e) => {
                setManualIp(e.target.value);
                if (ipError) setIpError(null);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-all"
              required
            />
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Reason (Optional)"
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-md glow-rose"
          >
            <Plus className="w-4 h-4" />
            <span>Block IP</span>
          </button>
          </div>
          {ipError && <p className="text-[11px] text-rose-400 font-mono">{ipError}</p>}
        </form>

        {/* Blacklisted IPs List */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-2.5">
          {blacklistedIps.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-mono space-y-2">
              <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
              <p>No IP addresses are currently blacklisted or blocked.</p>
            </div>
          ) : (
            blacklistedIps.map((item) => (
              <div
                key={item.ip}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs font-mono hover:border-rose-800/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-950/50 text-rose-400 border border-rose-900/60">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-sm">{item.ip}</span>
                      <span className="px-1.5 py-0.2 text-[9px] rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                        BLOCKED
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Reason: <strong className="text-slate-300">{item.reason}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>{new Date(item.blockedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onUnblockIp(item.ip)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-emerald-300 bg-slate-900 hover:bg-emerald-950/80 border border-slate-700 hover:border-emerald-700 transition-all flex items-center gap-1 shrink-0"
                  title="Unblock and allow connection"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400" />
                  <span>Unblock</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center gap-3 text-xs text-slate-400">
          <span className="font-mono text-[11px]">Total Blocked: {blacklistedIps.length}</span>
          <button
            type="button"
            disabled={isResetting || blacklistedIps.length === 0}
            onClick={async () => {
              const ok = window.confirm(
                'Reset blacklist?\n\nAll blocked IPs will be unblocked (Windows Firewall rules removed).'
              );
              if (!ok) return;
              setIsResetting(true);
              try {
                await onResetBlacklist();
              } finally {
                setIsResetting(false);
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-200 hover:text-amber-100 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 transition-colors flex items-center gap-1.5 disabled:opacity-40"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            {isResetting ? 'Resetting…' : 'Reset List'}
          </button>
        </div>
      </div>
    </div>
  );
};
