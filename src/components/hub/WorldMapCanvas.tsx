import React from 'react';
import { ContinentName } from '../../utils/continentResolver';
import { Globe } from 'lucide-react';

interface WorldMapCanvasProps {
  selectedContinent: ContinentName | 'All';
  onSelectContinent: (continent: ContinentName | 'All') => void;
  continentStats: Record<ContinentName | 'All', { ipCount: number; nodeCount: number }>;
}

export const WorldMapCanvas: React.FC<WorldMapCanvasProps> = ({
  selectedContinent,
  onSelectContinent,
  continentStats,
}) => {
  return (
    <div className="relative w-full rounded-2xl bg-slate-950/90 border border-slate-800/80 p-5 overflow-hidden shadow-2xl space-y-3 select-none">
      {/* Background Cyber Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between text-xs font-mono relative z-10">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>GLOBAL THREAT MAP RADAR CANOPY</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
            <span>Active Continent: <strong className="text-emerald-300">{selectedContinent}</strong></span>
          </span>
          <span>• Total Nodes: <strong className="text-cyan-300">{continentStats.All.nodeCount}</strong></span>
        </div>
      </div>

      {/* SVG Interactive World Canvas */}
      <div className="relative w-full h-[220px] bg-slate-900/40 rounded-xl border border-slate-800/60 overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-700"
        >
          {/* World Continent Vector Outlines */}
          {/* North America */}
          <path
            d="M 120 80 Q 220 50 320 120 T 260 260 T 140 220 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'North America' ? '#9333ea25' : '#1e293b30'}
            stroke={selectedContinent === 'North America' ? '#c084fc' : '#47556940'}
            strokeWidth={selectedContinent === 'North America' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-purple-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('North America')}
          />

          {/* South America */}
          <path
            d="M 280 270 Q 340 290 320 380 T 260 460 T 240 340 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'South America' ? '#f59e0b25' : '#1e293b30'}
            stroke={selectedContinent === 'South America' ? '#fbbf24' : '#47556940'}
            strokeWidth={selectedContinent === 'South America' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-amber-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('South America')}
          />

          {/* Europe */}
          <path
            d="M 450 70 Q 560 60 580 140 T 480 200 T 440 120 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Europe' ? '#3b82f625' : '#1e293b30'}
            stroke={selectedContinent === 'Europe' ? '#60a5fa' : '#47556940'}
            strokeWidth={selectedContinent === 'Europe' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-blue-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Europe')}
          />

          {/* Africa */}
          <path
            d="M 460 210 Q 580 200 560 340 T 480 430 T 440 300 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Africa' ? '#10b98125' : '#1e293b30'}
            stroke={selectedContinent === 'Africa' ? '#34d399' : '#47556940'}
            strokeWidth={selectedContinent === 'Africa' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-emerald-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Africa')}
          />

          {/* Asia */}
          <path
            d="M 590 80 Q 820 60 880 180 T 720 280 T 580 190 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Asia' ? '#06b6d425' : '#1e293b30'}
            stroke={selectedContinent === 'Asia' ? '#22d3ee' : '#47556940'}
            strokeWidth={selectedContinent === 'Asia' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-cyan-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Asia')}
          />

          {/* Oceania / Australia */}
          <path
            d="M 760 320 Q 890 310 880 410 T 780 430 T 740 360 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Oceania' ? '#10b98125' : '#1e293b30'}
            stroke={selectedContinent === 'Oceania' ? '#34d399' : '#47556940'}
            strokeWidth={selectedContinent === 'Oceania' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-emerald-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Oceania')}
          />
        </svg>

        {/* Interactive Ping Bubbles Over Continents */}
        {/* Asia Node */}
        <div
          onClick={() => onSelectContinent('Asia')}
          className={`absolute top-[32%] left-[72%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'Asia' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-cyan-500/40 animate-ping" />
            <div className="p-1.5 rounded-full bg-slate-950 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)] flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold">
              <span>🌏 Asia</span>
              <span className="px-1 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px]">
                {continentStats.Asia.ipCount} IPs
              </span>
            </div>
          </div>
        </div>

        {/* North America Node */}
        <div
          onClick={() => onSelectContinent('North America')}
          className={`absolute top-[30%] left-[22%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'North America' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-purple-500/40 animate-ping" />
            <div className="p-1.5 rounded-full bg-slate-950 border border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.8)] flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold">
              <span>🌎 N.America</span>
              <span className="px-1 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[9px]">
                {continentStats['North America'].ipCount} IPs
              </span>
            </div>
          </div>
        </div>

        {/* Europe Node */}
        <div
          onClick={() => onSelectContinent('Europe')}
          className={`absolute top-[28%] left-[50%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'Europe' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-blue-500/40 animate-ping" />
            <div className="p-1.5 rounded-full bg-slate-950 border border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.8)] flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold">
              <span>🌍 Europe</span>
              <span className="px-1 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[9px]">
                {continentStats.Europe.ipCount} IPs
              </span>
            </div>
          </div>
        </div>

        {/* South America Node */}
        <div
          onClick={() => onSelectContinent('South America')}
          className={`absolute top-[70%] left-[30%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'South America' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-7 h-7 rounded-full bg-amber-500/30 animate-ping" />
            <div className="p-1 rounded-full bg-slate-950 border border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)] flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold">
              <span>🌍 S.America</span>
              <span className="px-1 py-0.2 rounded-full bg-amber-950 text-amber-300 text-[8px]">
                {continentStats['South America'].ipCount}
              </span>
            </div>
          </div>
        </div>

        {/* Oceania Node */}
        <div
          onClick={() => onSelectContinent('Oceania')}
          className={`absolute top-[72%] left-[82%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'Oceania' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-7 h-7 rounded-full bg-emerald-500/30 animate-ping" />
            <div className="p-1 rounded-full bg-slate-950 border border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.6)] flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold">
              <span>🌏 Oceania</span>
              <span className="px-1 py-0.2 rounded-full bg-emerald-950 text-emerald-300 text-[8px]">
                {continentStats.Oceania.ipCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
