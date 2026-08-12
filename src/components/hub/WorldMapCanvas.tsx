import React from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { ContinentName } from '../../utils/continentResolver';
import { Globe, MapPin } from 'lucide-react';

// World Atlas TopoJSON 110m map data URL
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapCanvasProps {
  selectedContinent: ContinentName | 'All';
  onSelectContinent: (continent: ContinentName | 'All') => void;
  continentStats: Record<ContinentName | 'All', { ipCount: number; nodeCount: number }>;
}

// Camera coordinates for continents [longitude, latitude], zoom level
const continentCoordinates: Record<ContinentName | 'All', { center: [number, number]; zoom: number }> = {
  All: { center: [10, 10], zoom: 1 },
  Asia: { center: [100, 32], zoom: 2.5 },
  'North America': { center: [-100, 45], zoom: 2.5 },
  Europe: { center: [15, 52], zoom: 3.2 },
  'South America': { center: [-60, -20], zoom: 2.5 },
  Oceania: { center: [135, -25], zoom: 2.8 },
  Africa: { center: [20, 0], zoom: 2.5 },
  Unknown: { center: [10, 10], zoom: 1 },
};

// Continent centroids for ping radar markers
const continentMarkers: { name: ContinentName; coordinates: [number, number]; color: string }[] = [
  { name: 'Asia', coordinates: [100, 32], color: '#22d3ee' },
  { name: 'North America', coordinates: [-100, 40], color: '#c084fc' },
  { name: 'Europe', coordinates: [15, 50], color: '#60a5fa' },
  { name: 'South America', coordinates: [-60, -20], color: '#fbbf24' },
  { name: 'Oceania', coordinates: [135, -25], color: '#34d399' },
  { name: 'Africa', coordinates: [20, 0], color: '#34d399' },
];

export const WorldMapCanvas: React.FC<WorldMapCanvasProps> = ({
  selectedContinent,
  onSelectContinent,
  continentStats,
}) => {
  const currentView = continentCoordinates[selectedContinent] || continentCoordinates.All;

  return (
    <div className="relative w-full rounded-2xl bg-slate-950/95 border border-slate-800/80 p-5 overflow-hidden shadow-2xl space-y-3 select-none">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between text-xs font-mono relative z-10">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Globe className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>REAL-TIME GIS TOPOGRAPHIC WORLD MAP</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
            <span>Active Continent: <strong className="text-emerald-300">{selectedContinent}</strong></span>
          </span>
          <span>• Total Nodes: <strong className="text-cyan-300">{continentStats.All.nodeCount}</strong></span>
        </div>
      </div>

      {/* Real TopoJSON GIS World Map Canvas */}
      <div className="relative w-full h-[250px] bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden flex items-center justify-center">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 110 }}
          className="w-full h-full"
        >
          <ZoomableGroup
            center={currentView.center}
            zoom={currentView.zoom}
            maxZoom={6}
            minZoom={1}
            translateExtent={[
              [-100, -100],
              [1100, 700],
            ]}
          >
            {/* Real World TopoJSON Country Geographies */}
            <Geographies geography={geoUrl}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1e293b"
                    stroke="#334155"
                    strokeWidth={0.5}
                    style={{
                      default: {
                        fill: '#1e293b',
                        stroke: '#334155',
                        strokeWidth: 0.5,
                        outline: 'none',
                      },
                      hover: {
                        fill: '#0f766e',
                        stroke: '#22d3ee',
                        strokeWidth: 1,
                        outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: '#047857',
                        outline: 'none',
                      },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* GIS Radar Ping Markers over Continent Centroids */}
            {continentMarkers.map((marker) => {
              const isSelected = selectedContinent === marker.name || selectedContinent === 'All';
              const stats = continentStats[marker.name];
              if (!stats || stats.ipCount === 0) return null;

              return (
                <Marker key={marker.name} coordinates={marker.coordinates}>
                  <g
                    className="cursor-pointer group"
                    onClick={() => onSelectContinent(marker.name)}
                  >
                    {/* Pulsing Radar Ring */}
                    <circle
                      r={10}
                      fill={marker.color}
                      opacity={0.35}
                      className="animate-ping"
                    />
                    <circle
                      r={5}
                      fill={marker.color}
                      stroke="#020617"
                      strokeWidth={1.5}
                    />

                    {/* Interactive Badge Text overlay */}
                    <foreignObject x={-45} y={-32} width={90} height={30}>
                      <div
                        className={`px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-700 text-[9px] font-mono font-bold flex items-center justify-center gap-1 shadow-lg transition-transform ${
                          isSelected ? 'scale-110 border-cyan-400 text-cyan-300' : 'text-slate-300'
                        }`}
                      >
                        <MapPin className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{marker.name}</span>
                        <span className="text-[8px] text-cyan-300 font-bold px-1 rounded bg-slate-900">
                          {stats.ipCount}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </div>
  );
};
