import React from 'react';
import { ProcessTrafficPoint } from '../types/network';
import { Cpu, Globe, MessageSquare, Shield, Gamepad2, Code, Cloud } from 'lucide-react';

interface AppBandwidthCardProps {
  processes: ProcessTrafficPoint[];
}

export const AppBandwidthCard: React.FC<AppBandwidthCardProps> = ({ processes }) => {
  const maxBytes = Math.max(...processes.map((p) => p.bytesTotal), 1);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderIcon = (type: ProcessTrafficPoint['iconType']) => {
    switch (type) {
      case 'browser':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case 'system':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'game':
        return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
      case 'code':
        return <Code className="w-4 h-4 text-sky-400" />;
      case 'cloud':
        return <Cloud className="w-4 h-4 text-blue-400" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-200">App & Process Traffic Breakdown</h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
          Top Active PIDs
        </span>
      </div>

      {/* Process List */}
      <div className="space-y-3">
        {processes.map((proc) => {
          const percent = Math.min(Math.round((proc.bytesTotal / maxBytes) * 100), 100);

          return (
            <div key={`${proc.processName}-${proc.pid}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    {renderIcon(proc.iconType)}
                  </div>
                  <div>
                    <span className="font-bold text-slate-200">{proc.processName}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">PID: {proc.pid}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-semibold text-cyan-400">{formatBytes(proc.bytesTotal)}</span>
                  <span className="text-[10px] text-slate-500 ml-1.5 font-sans">
                    ({proc.packetsIn} ↓ / {proc.packetsOut} ↑ pkts)
                  </span>
                </div>
              </div>

              {/* Custom Animated Progress Bar */}
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
