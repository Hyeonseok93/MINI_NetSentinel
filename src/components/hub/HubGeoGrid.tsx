import React from 'react';
import { GeoNode } from '../../types/network';
import { formatBytes } from '../../utils/formatters';
import { HelpCircle, Navigation } from 'lucide-react';

interface HubGeoGridProps {
  filteredGeoNodes: GeoNode[];
}

export const HubGeoGrid: React.FC<HubGeoGridProps> = ({ filteredGeoNodes }) => {
  return (
    <div className="p-6 space-y-6">
      <div className="relative w-full min-h-[22rem] bg-slate-950/90 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 w-full">
          {filteredGeoNodes.length === 0 ? (
            <div className="col-span-5 py-12 text-center text-slate-500 font-mono">
              No country geo nodes match the search criteria.
            </div>
          ) : (
            filteredGeoNodes.map((node) => {
              const isUnknown = node.countryCode === 'UNK' || node.country === 'Unknown Location';

              return (
                <div
                  key={node.country}
                  className={`p-4 rounded-xl bg-slate-900/90 border flex flex-col items-center justify-center text-center gap-2 shadow-xl transition-all ${
                    isUnknown
                      ? 'border-purple-800/80 hover:border-purple-500/80 bg-purple-950/20'
                      : 'border-slate-800 hover:border-emerald-500/50'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl border ${
                      isUnknown
                        ? 'bg-purple-950/80 text-purple-400 border-purple-800/60'
                        : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                    }`}
                  >
                    {isUnknown ? <HelpCircle className="w-5 h-5 text-purple-400" /> : <Navigation className="w-5 h-5" />}
                  </div>
                  <span className="font-bold text-xs text-slate-100">{node.country} ({node.countryCode})</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      isUnknown
                        ? 'text-purple-300 bg-purple-950/80 border-purple-800/60'
                        : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                    }`}
                  >
                    {node.activeIpCount} Active IPs
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{formatBytes(node.totalBytes)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
