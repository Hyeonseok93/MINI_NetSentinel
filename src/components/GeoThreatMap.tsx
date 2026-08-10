import React from 'react';
import { GeoNode } from '../types/network';
import { Globe2, Navigation, Radio } from 'lucide-react';

interface GeoThreatMapProps {
  nodes: GeoNode[];
}

export const GeoThreatMap: React.FC<GeoThreatMapProps> = ({ nodes }) => {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">Threat Geo-Location World Map</h2>
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
            <Radio className="w-3 h-3 animate-pulse" /> Live Telemetry
          </span>
        </div>

        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
          Source: KR (South Korea)
        </span>
      </div>

      {/* Cyberpunk Map Canvas Wrapper */}
      <div className="relative w-full h-48 bg-slate-950/90 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:16px_16px]" />

        {/* World Map Stylized SVG Nodes Representation */}
        <svg className="w-full h-full absolute inset-0 text-slate-800 opacity-30" viewBox="0 0 800 400" fill="currentColor">
          <path d="M150,120 Q200,80 300,110 T500,130 T700,100 Q750,200 650,280 T400,320 T150,250 Z" />
        </svg>

        {/* Laser Arcs & Target Country Nodes */}
        <div className="relative z-10 w-full h-full p-4 flex flex-wrap items-center justify-around gap-3">
          {nodes.map((node) => (
            <div
              key={node.country}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5 shadow-lg hover:border-cyan-500/50 transition-all group"
            >
              <div className="p-1.5 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 group-hover:scale-110 transition-transform">
                <Navigation className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-100">{node.country}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1 rounded">
                    {node.countryCode}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mt-0.5">
                  <span className="text-cyan-400">{node.activeIpCount} Active IPs</span>
                  <span>•</span>
                  <span>{formatBytes(node.totalBytes)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
