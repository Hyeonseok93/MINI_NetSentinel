import React from 'react';
import { Server, Cpu, Globe2, HardDrive } from 'lucide-react';
import { MainTabKey } from './hubTypes';

interface HubTabBarProps {
  activeTab: MainTabKey;
  setActiveTab: (tab: MainTabKey) => void;
  sessionCount: number;
  appCount: number;
  geoCount: number;
  quotaPercent: number;
}

export const HubTabBar: React.FC<HubTabBarProps> = ({
  activeTab,
  setActiveTab,
  sessionCount,
  appCount,
  geoCount,
  quotaPercent,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
      <button
        onClick={() => setActiveTab('sessions')}
        className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
          activeTab === 'sessions'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 glow-cyan shadow-md'
            : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
        }`}
      >
        <Server className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="truncate">IP Sessions</span>
        <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-cyan-300 font-mono">
          {sessionCount}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('apps')}
        className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
          activeTab === 'apps'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 glow-purple shadow-md'
            : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
        }`}
      >
        <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="truncate">App Breakdown</span>
        <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-purple-300 font-mono">
          {appCount}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('geo')}
        className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
          activeTab === 'geo'
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 glow-emerald shadow-md'
            : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
        }`}
      >
        <Globe2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="truncate">Geo Threat Map</span>
        <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-emerald-300 font-mono">
          {geoCount}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('quota')}
        className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2.5 w-full ${
          activeTab === 'quota'
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 glow-amber shadow-md'
            : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80'
        }`}
      >
        <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="truncate">Bandwidth Quota</span>
        <span className="px-2 py-0.5 text-[10px] bg-slate-800 rounded-full text-amber-300 font-mono">
          {quotaPercent}%
        </span>
      </button>
    </div>
  );
};
