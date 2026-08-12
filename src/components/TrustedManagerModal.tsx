import React, { useState } from 'react';
import { X, ShieldCheck, Trash2, Plus, Search, CheckCircle, Shield, CheckCircle2, RotateCcw, ArrowUpRight } from 'lucide-react';
import { TrustedEntry } from '../types/network';
import { normalizeIpv4 } from '../utils/ip';

export interface VerifiedNormalEntry {
  ip: string;
  domain?: string;
  country: string;
  lastSeen: string;
}

interface TrustedManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trustedList: TrustedEntry[];
  verifiedNormalList: VerifiedNormalEntry[];
  onRemoveTrusted: (ip: string) => void;
  onAddTrusted: (ip: string, domain?: string) => void;
  onAddVerifiedNormal: (ip: string, domain?: string) => void;
  onPromoteToBaseline: (ip: string) => void;
  onResetNormalStatus: (ip: string) => void;
  onResetTrustedList: () => void;
  onResetVerifiedList: () => void;
}

export const TrustedManagerModal: React.FC<TrustedManagerModalProps> = ({
  isOpen,
  onClose,
  trustedList,
  verifiedNormalList,
  onRemoveTrusted,
  onAddTrusted,
  onAddVerifiedNormal,
  onPromoteToBaseline,
  onResetNormalStatus,
  onResetTrustedList,
  onResetVerifiedList,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'whitelist' | 'verifiedNormal'>('whitelist');
  const [newIpInput, setNewIpInput] = useState('');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [newNormalIpInput, setNewNormalIpInput] = useState('');
  const [newNormalDomainInput, setNewNormalDomainInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddManualTrusted = (e: React.FormEvent) => {
    e.preventDefault();
    const safeIp = normalizeIpv4(newIpInput);
    if (!safeIp) {
      setFormError('Enter a valid IPv4 address');
      return;
    }
    setFormError(null);
    onAddTrusted(safeIp, newDomainInput.trim() || undefined);
    setNewIpInput('');
    setNewDomainInput('');
  };

  const handleAddManualNormal = (e: React.FormEvent) => {
    e.preventDefault();
    const safeIp = normalizeIpv4(newNormalIpInput);
    if (!safeIp) {
      setFormError('Enter a valid IPv4 address');
      return;
    }
    setFormError(null);
    onAddVerifiedNormal(safeIp, newNormalDomainInput.trim() || undefined);
    setNewNormalIpInput('');
    setNewNormalDomainInput('');
  };

  const filteredTrustedList = trustedList.filter(
    (item) =>
      item.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.domain && item.domain.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredVerifiedNormalList = verifiedNormalList.filter(
    (item) =>
      item.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.domain && item.domain.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Security Verification & Baseline Hub</h3>
                <p className="text-[11px] text-slate-400">Manage verified normal IP sessions and trusted baseline whitelists</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub Navigation Tabs (50:50 Equal Width Grid Layout) */}
          <div className="grid grid-cols-2 gap-2 border-b border-slate-800/80 -mb-4 pb-2 w-full">
            <button
              onClick={() => setActiveSubTab('whitelist')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                activeSubTab === 'whitelist'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 glow-emerald shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-900/60 border border-slate-800/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Trusted Baseline Whitelist</span>
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 rounded-full text-emerald-400 font-mono">
                {trustedList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('verifiedNormal')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                activeSubTab === 'verifiedNormal'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 glow-cyan shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/40 hover:bg-slate-900/60 border border-slate-800/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Verified Normal IPs</span>
              <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 rounded-full text-sky-400 font-mono">
                {verifiedNormalList.length}
              </span>
            </button>
          </div>
        </div>
        {formError && (
          <p className="px-4 pb-2 text-[11px] text-rose-400 font-mono">{formError}</p>
        )}

        {/* Tab Content 1: Trusted Baseline Whitelist Manager */}
        {activeSubTab === 'whitelist' && (
          <div className="p-5 text-xs text-slate-300 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {/* Manual Trusted Registration Form */}
            <form onSubmit={handleAddManualTrusted} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="font-semibold text-slate-200 text-xs block">
                Register New Trusted Baseline IP / Domain
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="IP Address (e.g. 1.1.1.1)"
                  value={newIpInput}
                  onChange={(e) => setNewIpInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  required
                />
                <input
                  type="text"
                  placeholder="Domain (Optional)"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/30 transition-colors flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Trust</span>
                </button>
              </div>
            </form>

            {/* Whitelist Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search registered Whitelist IPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>

            {/* Trusted IPs List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {filteredTrustedList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 font-mono">
                  No trusted IP entries found in whitelist.
                </div>
              ) : (
                filteredTrustedList.map((item) => (
                  <div
                    key={item.ip}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-200">{item.ip}</span>
                          {item.domain && (
                            <span className="font-mono text-[11px] text-slate-400">({item.domain})</span>
                          )}
                          {item.note && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {item.note}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Added: {item.addedAt}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveTrusted(item.ip)}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400 hover:bg-rose-900/50 hover:text-rose-300 transition-colors flex items-center gap-1 text-[11px]"
                      title="Untrust and remove from Whitelist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Untrust (Remove)</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab Content 2: Verified Normal IPs List */}
        {activeSubTab === 'verifiedNormal' && (
          <div className="p-5 text-xs text-slate-300 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {/* Manual Verified Normal Registration Form */}
            <form onSubmit={handleAddManualNormal} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="font-semibold text-slate-200 text-xs block">
                Register New Verified Normal IP / Domain
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="IP Address (e.g. 8.8.4.4)"
                  value={newNormalIpInput}
                  onChange={(e) => setNewNormalIpInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                  required
                />
                <input
                  type="text"
                  placeholder="Domain (Optional)"
                  value={newNormalDomainInput}
                  onChange={(e) => setNewNormalDomainInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-sky-500/20 text-sky-400 border border-sky-500/40 rounded-lg hover:bg-sky-500/30 transition-colors flex items-center gap-1 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Normal</span>
                </button>
              </div>
            </form>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search verified normal IPs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>

            {/* Verified Normal List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {filteredVerifiedNormalList.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-mono">
                  No verified normal IP sessions registered yet.
                  <br />
                  <span className="text-[11px] text-slate-600">Click [Verify Normal] on New IPs or use the form above to add entries.</span>
                </div>
              ) : (
                filteredVerifiedNormalList.map((item) => (
                  <div
                    key={item.ip}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-100">{item.ip}</span>
                          {item.domain ? (
                            <span className="font-mono text-[11px] text-slate-400">({item.domain})</span>
                          ) : (
                            <span className="text-[10px] text-slate-600 italic">Unresolved</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>Location: {item.country}</span>
                          <span>Last Seen: {item.lastSeen}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPromoteToBaseline(item.ip)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/60 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                        title="Promote to Trusted Baseline Whitelist"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Promote to Baseline</span>
                      </button>

                      <button
                        onClick={() => onResetNormalStatus(item.ip)}
                        className="px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 text-[11px]"
                        title="Reset status back to New IP"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400" />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center gap-3 text-xs text-slate-400">
          <span className="font-mono text-[11px]">
            {activeSubTab === 'whitelist'
              ? `Total Whitelisted: ${trustedList.length} Entries`
              : `Total Verified Normal: ${verifiedNormalList.length} Sessions`}
          </span>
          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'whitelist') {
                const ok = window.confirm(
                  'Reset Trusted Baseline list?\n\nUser-added trusted IPs will be removed. Built-in defaults (8.8.8.8, etc.) stay.'
                );
                if (ok) onResetTrustedList();
              } else {
                const ok = window.confirm(
                  'Reset Verified Normal list?\n\nAll verified IPs will return to NEW (unless Trusted/Blocked).'
                );
                if (ok) onResetVerifiedList();
              }
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-200 hover:text-amber-100 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset List
          </button>
        </div>
      </div>
    </div>
  );
};
