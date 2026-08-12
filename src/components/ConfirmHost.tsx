import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ConfirmRequest, settleConfirm, subscribeConfirm } from '../ui/confirmBus';

type State = (ConfirmRequest & { resolve: (ok: boolean) => void }) | null;

export const ConfirmHost: React.FC = () => {
  const [state, setState] = useState<State>(null);

  useEffect(() => subscribeConfirm(setState), []);

  if (!state) return null;

  const tone = state.tone || 'warning';
  const confirmCls =
    tone === 'danger'
      ? 'bg-rose-500 hover:bg-rose-400 text-white border-rose-400'
      : tone === 'warning'
        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300'
        : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-300';

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-slate-950/75 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="glass-panel w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        >
          <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-900/90">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-400/80">NetSentinel</p>
                <h3 className="text-sm font-semibold text-slate-100 mt-0.5">{state.title}</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => settleConfirm(false)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-3 text-xs text-slate-300">
            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{state.message}</p>
            {state.detail ? (
              <p className="text-[11px] text-slate-500 whitespace-pre-wrap leading-relaxed border-t border-slate-800 pt-3">
                {state.detail}
              </p>
            ) : null}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => settleConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              {state.cancelLabel || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => settleConfirm(true)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold border transition-all ${confirmCls}`}
            >
              {state.confirmLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
