import React, { useState } from 'react';
import { GeoNode, IpSession } from '../../types/network';
import { formatBytes } from '../../utils/formatters';
import { getContinentName, ContinentName } from '../../utils/continentResolver';
import { WorldMapCanvas } from './WorldMapCanvas';
import {
  HelpCircle,
  Navigation,
  Globe,
  Compass,
  ChevronDown,
  ChevronUp,
  Server,
} from 'lucide-react';

interface HubGeoGridProps {
  filteredGeoNodes: GeoNode[];
  sessions?: IpSession[];
  geoSubTab?: 'live' | 'cumulative';
  getCumulativeGeoSessions?: (country: string) => IpSession[];
}

export const HubGeoGrid: React.FC<HubGeoGridProps> = ({
  filteredGeoNodes,
  sessions = [],
  geoSubTab = 'live',
  getCumulativeGeoSessions,
}) => {
  const [selectedContinent, setSelectedContinent] = useState<ContinentName | 'All'>('All');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  const toggleCountryExpand = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  // Group GeoNodes by Continent for Count Badges
  const continentStats: Record<ContinentName | 'All', { ipCount: number; nodeCount: number }> = {
    All: { ipCount: 0, nodeCount: filteredGeoNodes.length },
    Asia: { ipCount: 0, nodeCount: 0 },
    'North America': { ipCount: 0, nodeCount: 0 },
    Europe: { ipCount: 0, nodeCount: 0 },
    'South America': { ipCount: 0, nodeCount: 0 },
    Oceania: { ipCount: 0, nodeCount: 0 },
    Africa: { ipCount: 0, nodeCount: 0 },
    Unknown: { ipCount: 0, nodeCount: 0 },
  };

  filteredGeoNodes.forEach((node) => {
    const cont = getContinentName(node.countryCode, node.country);
    continentStats.All.ipCount += node.activeIpCount;
    if (continentStats[cont]) {
      continentStats[cont].ipCount += node.activeIpCount;
      continentStats[cont].nodeCount += 1;
    }
  });

  // Filter GeoNodes based on selected continent
  const displayGeoNodes = filteredGeoNodes.filter((node) => {
    if (selectedContinent === 'All') return true;
    const cont = getContinentName(node.countryCode, node.country);
    return cont === selectedContinent;
  });

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 0. Interactive SVG World Map Canvas */}
      <WorldMapCanvas
        selectedContinent={selectedContinent}
        onSelectContinent={(cont) => setSelectedContinent(cont)}
        continentStats={continentStats}
      />

      {/* 1. Continent Category Selector Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
        <button
          onClick={() => setSelectedContinent('All')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'All'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md glow-emerald'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All Continents</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-emerald-300 border border-emerald-800">
            {continentStats.All.nodeCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedContinent('Asia')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'Asia'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md glow-emerald'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>🌏 Asia</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-cyan-300 border border-cyan-800">
            {continentStats.Asia.nodeCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedContinent('North America')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'North America'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md glow-emerald'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 text-purple-400 shrink-0" />
          <span>🌎 North America</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-purple-300 border border-purple-800">
            {continentStats['North America'].nodeCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedContinent('Europe')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'Europe'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md glow-emerald'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 text-blue-400 shrink-0" />
          <span>🌍 Europe</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-blue-300 border border-blue-800">
            {continentStats.Europe.nodeCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedContinent('South America')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'South America'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md glow-emerald'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 text-amber-400 shrink-0" />
          <span>🌍 South America</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-amber-300 border border-amber-800">
            {continentStats['South America'].nodeCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedContinent('Oceania')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'Oceania'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md glow-emerald'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>🌏 Oceania</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-emerald-300 border border-emerald-800">
            {continentStats.Oceania.nodeCount}
          </span>
        </button>

        <button
          onClick={() => setSelectedContinent('Unknown')}
          className={`py-2 px-3.5 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            selectedContinent === 'Unknown'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-md glow-purple'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
          <span>❓ Unknown / Local</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-slate-950 rounded-full font-mono text-purple-300 border border-purple-800">
            {continentStats.Unknown.nodeCount}
          </span>
        </button>
      </div>

      {/* 2. Interactive Geo Grid Container (1-Column Full Width List with Flexbox gap-3) */}
      <div className="flex flex-col gap-3 w-full">
        {displayGeoNodes.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono">
            No country nodes match the selected continent filter ({selectedContinent}).
          </div>
        ) : (
          displayGeoNodes.map((node) => {
            const isUnknown = node.countryCode === 'UNK' || node.country === 'Unknown Location';
            const isExpanded = expandedCountries.has(node.country);
            const continentName = getContinentName(node.countryCode, node.country);

            // Filter IP Sessions connecting to this country (Live vs Permanent Cumulative History)
            const matchedSessions =
              geoSubTab === 'cumulative' && getCumulativeGeoSessions
                ? getCumulativeGeoSessions(node.country)
                : sessions.filter(
                    (s) => s.country === node.country || (isUnknown && (s.country === 'Unknown Location' || !s.country))
                  );

            return (
              <div
                key={node.country}
                className={`p-4 rounded-2xl bg-slate-900/70 border transition-all space-y-3 shadow-lg ${
                  isExpanded
                    ? 'border-emerald-500/80 bg-slate-900/95 shadow-xl'
                    : isUnknown
                    ? 'border-purple-800/60 hover:border-purple-500/80 bg-purple-950/10'
                    : 'border-slate-800/80 hover:border-emerald-500/60'
                }`}
              >
                {/* Main Card Header */}
                <div
                  onClick={() => toggleCountryExpand(node.country)}
                  className="flex items-center justify-between text-xs font-mono cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border transition-all ${
                        isUnknown
                          ? 'bg-purple-950/80 text-purple-400 border-purple-800/60 group-hover:border-purple-500'
                          : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 group-hover:border-emerald-500'
                      }`}
                    >
                      {isUnknown ? <HelpCircle className="w-5 h-5 text-purple-400" /> : <Navigation className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 group-hover:text-emerald-300 transition-colors">
                        {node.country} ({node.countryCode})
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <span>{continentName}</span>
                        <span className="text-slate-600">•</span>
                        <span>Click to {isExpanded ? 'collapse' : 'view IPs'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold block mb-0.5 ${
                        isUnknown
                          ? 'text-purple-300 bg-purple-950/80 border-purple-800/60'
                          : 'text-emerald-300 bg-emerald-950/80 border-emerald-800/60'
                      }`}
                    >
                      {node.activeIpCount} IPs
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-300">{formatBytes(node.totalBytes)}</span>
                  </div>
                </div>

                {/* Expandable Accordion: All IP Sessions connected to this Country */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pb-1">
                      <span>Connected IP Sessions ({matchedSessions.length})</span>
                      <span className="text-[10px] font-mono text-emerald-400">Geo Telemetry</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                      {matchedSessions.length === 0 ? (
                        <div className="p-2 text-[10px] font-mono text-slate-500 italic text-center">
                          No active IP sessions recorded for this country.
                        </div>
                      ) : (
                        matchedSessions.map((sess) => (
                          <div
                            key={sess.ip}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs font-mono"
                          >
                            <div className="flex items-center gap-2">
                              <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <div>
                                <div className="text-slate-100 font-bold">{sess.ip}</div>
                                <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                  {sess.domain || 'Unresolved Domain'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-cyan-300 text-[11px]">{formatBytes(sess.totalBytes)}</div>
                              <div className="text-slate-500 text-[9px]">
                                {sess.packetsIn} ↓ / {sess.packetsOut} ↑
                              </div>
                            </div>
                          </div>
                        ))
                      )}
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
