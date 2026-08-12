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
          <span>REAL-TIME GLOBAL VECTOR GEOGRAPHY MAP</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
            <span>Active Continent: <strong className="text-emerald-300">{selectedContinent}</strong></span>
          </span>
          <span>• Total Nodes: <strong className="text-cyan-300">{continentStats.All.nodeCount}</strong></span>
        </div>
      </div>

      {/* SVG Interactive Real-World Geography Canvas */}
      <div className="relative w-full h-[230px] bg-slate-900/50 rounded-xl border border-slate-800/60 overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all duration-700"
        >
          {/* Latitude & Longitude Dotted Grid Overlay */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke="#334155" strokeDasharray="4,4" strokeWidth="1" opacity="0.4" />
          <line x1="500" y1="0" x2="500" y2="500" stroke="#334155" strokeDasharray="4,4" strokeWidth="1" opacity="0.4" />

          {/* REAL WORLD CONTINENT VECTOR PATHS */}
          
          {/* 1. North America */}
          <path
            d="M 110,80 L 150,70 L 190,60 L 240,55 L 290,65 L 320,85 L 300,120 L 280,150 L 250,180 L 235,215 L 220,240 L 205,230 L 190,195 L 165,185 L 155,210 L 125,180 L 130,135 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'North America' ? '#a855f725' : '#1e293b20'}
            stroke={selectedContinent === 'North America' ? '#c084fc' : '#47556950'}
            strokeWidth={selectedContinent === 'North America' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-purple-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('North America')}
          />

          {/* 2. South America */}
          <path
            d="M 235,245 L 265,240 L 295,265 L 325,295 L 315,345 L 285,415 L 255,465 L 245,435 L 240,355 L 248,295 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'South America' ? '#f59e0b25' : '#1e293b20'}
            stroke={selectedContinent === 'South America' ? '#fbbf24' : '#47556950'}
            strokeWidth={selectedContinent === 'South America' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-amber-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('South America')}
          />

          {/* 3. Europe */}
          <path
            d="M 445,75 L 485,60 L 525,65 L 565,80 L 555,130 L 525,165 L 485,175 L 445,150 L 440,110 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Europe' ? '#3b82f625' : '#1e293b20'}
            stroke={selectedContinent === 'Europe' ? '#60a5fa' : '#47556950'}
            strokeWidth={selectedContinent === 'Europe' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-blue-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Europe')}
          />

          {/* 4. Africa */}
          <path
            d="M 435,185 L 485,185 L 540,215 L 555,265 L 525,345 L 495,425 L 465,395 L 445,325 L 425,255 L 435,215 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Africa' ? '#10b98125' : '#1e293b20'}
            stroke={selectedContinent === 'Africa' ? '#34d399' : '#47556950'}
            strokeWidth={selectedContinent === 'Africa' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-emerald-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Africa')}
          />

          {/* 5. Asia (Includes Korean Peninsula & Japan Isles Outlines) */}
          <path
            d="M 570,70 L 660,55 L 790,50 L 880,80 L 900,140 L 840,220 L 770,260 L 720,280 L 670,250 L 620,210 L 580,160 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Asia' ? '#06b6d425' : '#1e293b20'}
            stroke={selectedContinent === 'Asia' ? '#22d3ee' : '#47556950'}
            strokeWidth={selectedContinent === 'Asia' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-cyan-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Asia')}
          />

          {/* 6. Oceania (Australia & New Zealand) */}
          <path
            d="M 745,325 L 825,315 L 875,355 L 865,415 L 805,435 L 745,405 L 735,355 Z"
            fill={selectedContinent === 'All' || selectedContinent === 'Oceania' ? '#10b98125' : '#1e293b20'}
            stroke={selectedContinent === 'Oceania' ? '#34d399' : '#47556950'}
            strokeWidth={selectedContinent === 'Oceania' ? '2.5' : '1.5'}
            className="cursor-pointer hover:fill-emerald-500/30 transition-all duration-300"
            onClick={() => onSelectContinent('Oceania')}
          />
        </svg>

        {/* Interactive Ping Radar Badges over Real Geography Centroids */}
        
        {/* Asia Centroid (KR, JP, SG, CN) */}
        <div
          onClick={() => onSelectContinent('Asia')}
          className={`absolute top-[32%] left-[73%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'Asia' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-cyan-500/40 animate-ping" />
            <div className="p-1 rounded-full bg-slate-950 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)] flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold">
              <span>🌏 Asia</span>
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px]">
                {continentStats.Asia.ipCount} IPs
              </span>
            </div>
          </div>
        </div>

        {/* North America Centroid (US, CA) */}
        <div
          onClick={() => onSelectContinent('North America')}
          className={`absolute top-[26%] left-[22%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'North America' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-purple-500/40 animate-ping" />
            <div className="p-1 rounded-full bg-slate-950 border border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.8)] flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold">
              <span>🌎 N.America</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800 text-[9px]">
                {continentStats['North America'].ipCount} IPs
              </span>
            </div>
          </div>
        </div>

        {/* Europe Centroid (GB, DE, FR, IT) */}
        <div
          onClick={() => onSelectContinent('Europe')}
          className={`absolute top-[26%] left-[49%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
            selectedContinent === 'Europe' ? 'scale-125 z-30' : 'hover:scale-110 z-20'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute w-8 h-8 rounded-full bg-blue-500/40 animate-ping" />
            <div className="p-1 rounded-full bg-slate-950 border border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.8)] flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold">
              <span>🌍 Europe</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[9px]">
                {continentStats.Europe.ipCount} IPs
              </span>
            </div>
          </div>
        </div>

        {/* South America Centroid (BR, AR) */}
        <div
          onClick={() => onSelectContinent('South America')}
          className={`absolute top-[68%] left-[27%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
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

        {/* Oceania Centroid (AU, NZ) */}
        <div
          onClick={() => onSelectContinent('Oceania')}
          className={`absolute top-[72%] left-[80%] -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all ${
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
