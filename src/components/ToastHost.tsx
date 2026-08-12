import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { AppToast, dismissToast, subscribeToasts } from '../ui/toastBus';

function toneStyles(tone: AppToast['tone']) {
  switch (tone) {
    case 'success':
      return {
        border: 'border-emerald-700/70',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
        accent: 'text-emerald-300',
      };
    case 'warning':
      return {
        border: 'border-amber-700/70',
        icon: <AlertTriangle className="w-4 h-4 text-amber-300" />,
        accent: 'text-amber-300',
      };
    case 'danger':
      return {
        border: 'border-rose-700/70',
        icon: <ShieldAlert className="w-4 h-4 text-rose-300" />,
        accent: 'text-rose-300',
      };
    default:
      return {
        border: 'border-cyan-700/60',
        icon: <Bell className="w-4 h-4 text-cyan-300" />,
        accent: 'text-cyan-300',
      };
  }
}

export const ToastHost: React.FC = () => {
  const [items, setItems] = useState<AppToast[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[min(22rem,calc(100vw-2rem))] pointer-events-none">
      {items.map((t) => {
        const s = toneStyles(t.tone);
        return (
          <div
            key={t.id}
            className={`pointer-events-auto glass-panel rounded-xl border ${s.border} shadow-2xl overflow-hidden animate-in slide-in-from-right-2 fade-in duration-200`}
          >
            <div className="p-3 flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{s.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">NetSentinel</p>
                <p className={`text-xs font-semibold ${s.accent} mt-0.5`}>{t.title}</p>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{t.body}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
