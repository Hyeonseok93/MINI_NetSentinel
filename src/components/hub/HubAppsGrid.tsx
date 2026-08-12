import React, { useState } from 'react';
import { ProcessTrafficPoint } from '../../types/network';
import { formatBytes } from '../../utils/formatters';
import {
  Globe,
  MessageSquare,
  Shield,
  Gamepad2,
  Code,
  Cloud,
  Cpu,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface GroupedProcess {
  processName: string;
  totalBytes: number;
  totalPackets: number;
  packetsIn: number;
  packetsOut: number;
  iconType: ProcessTrafficPoint['iconType'];
  pids: ProcessTrafficPoint[];
}

interface HubAppsGridProps {
  groupedProcesses: GroupedProcess[];
  appSubTab: 'live' | 'cumulative';
  maxAppBytes: number;
}

export const HubAppsGrid: React.FC<HubAppsGridProps> = ({
  groupedProcesses,
  appSubTab,
  maxAppBytes,
}) => {
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  const toggleAppExpand = (appName: string) => {
    setExpandedApps((prev) => {
      const next = new Set(prev);
      if (next.has(appName)) {
        next.delete(appName);
      } else {
        next.add(appName);
      }
      return next;
    });
  };

  const renderProcIcon = (type: ProcessTrafficPoint['iconType']) => {
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
    <div className="p-6 space-y-4">
      <div className="flex flex-col space-y-3 w-full">
        {groupedProcesses.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono">
            No Windows app processes match the search criteria.
          </div>
        ) : (
          groupedProcesses.map((app) => {
            const isExpanded = expandedApps.has(app.processName);
            const currentDisplayBytes = appSubTab === 'live' ? Math.floor(app.totalBytes / 10) : app.totalBytes;
            const percent = Math.min(Math.round((currentDisplayBytes / maxAppBytes) * 100), 100);

            return (
              <div
                key={app.processName}
                className={`p-4 rounded-xl bg-slate-900/60 border transition-all space-y-3 ${
                  isExpanded ? 'border-purple-500/60 bg-slate-900/90 shadow-lg' : 'border-slate-800/80 hover:border-purple-500/40'
                }`}
              >
                {/* Main Grouped Header */}
                <div
                  onClick={() => toggleAppExpand(app.processName)}
                  className="flex items-center justify-between text-xs font-mono cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-purple-500/50 transition-all">
                      {renderProcIcon(app.iconType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-purple-300 transition-colors">
                          {app.processName}
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-950 text-purple-300 border border-purple-800/80">
                          {app.pids.length} {app.pids.length === 1 ? 'PID' : 'PIDs'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <span>Click to {isExpanded ? 'collapse' : 'expand PIDs list'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-purple-400" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-sm text-purple-400">
                      {formatBytes(currentDisplayBytes)}
                      {appSubTab === 'live' ? '/s' : ''}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {appSubTab === 'live'
                        ? `${Math.floor(app.packetsIn / 5)} ↓ / ${Math.floor(app.packetsOut / 5)} ↑ pkts/s`
                        : `${app.packetsIn.toLocaleString()} ↓ / ${app.packetsOut.toLocaleString()} ↑ pkts`}
                    </div>
                  </div>
                </div>

                {/* Main Group Progress Bar */}
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      appSubTab === 'live'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]'
                        : 'bg-gradient-to-r from-purple-500 to-cyan-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Expandable Accordion: All Child PIDs List */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pb-1">
                      <span>Detailed Sub-Processes List ({app.pids.length})</span>
                      <span className="text-[10px] font-mono text-purple-300">
                        {appSubTab === 'live' ? '⚡ Live Telemetry' : '📈 Cumulative History'}
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                      {app.pids.map((subProc) => {
                        const subBytes = appSubTab === 'live' ? Math.floor(subProc.bytesTotal / 10) : subProc.bytesTotal;

                        return (
                          <div
                            key={subProc.pid}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-purple-300 border border-slate-800 font-bold text-[10px]">
                                PID: {subProc.pid}
                              </span>
                              <span className="text-slate-300 truncate max-w-[140px] sm:max-w-xs">{app.processName}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-200 text-[11px]">{formatBytes(subBytes)}</span>
                              <span className="text-slate-500 text-[10px] ml-1.5">
                                ({subProc.packetsIn} ↓ / {subProc.packetsOut} ↑)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
