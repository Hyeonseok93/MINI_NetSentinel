import {
  Server,
  Search,
  SlidersHorizontal,
  Zap,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import type {
  AppSortOptionKey,
  GeoSortOptionKey,
  MainTabKey,
  SessionFilterType,
  SortOptionKey,
} from './hubTypes';

type Props = {
  activeTab: MainTabKey;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterType: SessionFilterType;
  setFilterType: (v: SessionFilterType) => void;
  sortOption: SortOptionKey;
  setSortOption: (v: SortOptionKey) => void;
  appSubTab: 'live' | 'cumulative';
  setAppSubTab: (v: 'live' | 'cumulative') => void;
  appSearchTerm: string;
  setAppSearchTerm: (v: string) => void;
  appSortOption: AppSortOptionKey;
  setAppSortOption: (v: AppSortOptionKey) => void;
  liveAppCount: number;
  cumulativeAppCount: number;
  onClearCumulativeProcesses?: () => void;
  geoSubTab: 'live' | 'cumulative';
  setGeoSubTab: (v: 'live' | 'cumulative') => void;
  geoSearchTerm: string;
  setGeoSearchTerm: (v: string) => void;
  geoSortOption: GeoSortOptionKey;
  setGeoSortOption: (v: GeoSortOptionKey) => void;
  liveGeoCount: number;
  cumulativeGeoCount: number;
  myPublicGeo: { country: string; countryCode: string };
  onClearCumulativeGeoNodes?: () => void;
};

export function HubTabControls({
  activeTab,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  sortOption,
  setSortOption,
  appSubTab,
  setAppSubTab,
  appSearchTerm,
  setAppSearchTerm,
  appSortOption,
  setAppSortOption,
  liveAppCount,
  cumulativeAppCount,
  onClearCumulativeProcesses,
  geoSubTab,
  setGeoSubTab,
  geoSearchTerm,
  setGeoSearchTerm,
  geoSortOption,
  setGeoSortOption,
  liveGeoCount,
  cumulativeGeoCount,
  myPublicGeo,
  onClearCumulativeGeoNodes,
}: Props) {
  if (activeTab === 'sessions') {
    return (
      <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Server className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200">Active Network Sessions</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search IP, Domain, Country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOptionKey)}
              className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer border-none p-0 pr-1"
            >
              <option value="packets-desc" className="bg-slate-900 text-slate-200">
                Packets (Highest First)
              </option>
              <option value="packets-asc" className="bg-slate-900 text-slate-200">
                Packets (Lowest First)
              </option>
              <option value="bytes-desc" className="bg-slate-900 text-slate-200">
                Volume (Highest First)
              </option>
              <option value="bytes-asc" className="bg-slate-900 text-slate-200">
                Volume (Lowest First)
              </option>
              <option value="ip-asc" className="bg-slate-900 text-slate-200">
                IP Address (0-9 / A-Z)
              </option>
              <option value="ip-desc" className="bg-slate-900 text-slate-200">
                IP Address (Z-A)
              </option>
              <option value="domain-asc" className="bg-slate-900 text-slate-200">
                Domain Name (A-Z)
              </option>
              <option value="recent-desc" className="bg-slate-900 text-slate-200">
                Last Activity (Recent First)
              </option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto justify-center">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'all'
                  ? 'bg-cyan-500/20 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('new')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'new'
                  ? 'bg-amber-500/20 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => setFilterType('normal')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'normal'
                  ? 'bg-sky-500/20 text-sky-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setFilterType('suspicious')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'suspicious'
                  ? 'bg-rose-500/20 text-rose-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Suspicious
            </button>
            <button
              type="button"
              onClick={() => setFilterType('baseline')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                filterType === 'baseline'
                  ? 'bg-emerald-500/20 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Baseline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'apps') {
    return (
      <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setAppSubTab('live')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              appSubTab === 'live'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse shrink-0" />
            <span>Live Real-time</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-purple-300 font-mono border border-purple-500/30">
              {liveAppCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAppSubTab('cumulative')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              appSubTab === 'cumulative'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Cumulative Total</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-cyan-300 font-mono border border-cyan-500/30">
              {Math.max(cumulativeAppCount, liveAppCount)}
            </span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search App or PID..."
              value={appSearchTerm}
              onChange={(e) => setAppSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <select
              value={appSortOption}
              onChange={(e) => setAppSortOption(e.target.value as AppSortOptionKey)}
              className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer border-none p-0 pr-1"
            >
              <option value="bytes-desc" className="bg-slate-900 text-slate-200">
                Bandwidth (Highest First)
              </option>
              <option value="bytes-asc" className="bg-slate-900 text-slate-200">
                Bandwidth (Lowest First)
              </option>
              <option value="packets-desc" className="bg-slate-900 text-slate-200">
                Packets (Highest First)
              </option>
              <option value="name-asc" className="bg-slate-900 text-slate-200">
                Process Name (A-Z)
              </option>
              <option value="pid-asc" className="bg-slate-900 text-slate-200">
                Most Active PIDs
              </option>
            </select>
          </div>
          {appSubTab === 'cumulative' && onClearCumulativeProcesses && (
            <button
              type="button"
              onClick={onClearCumulativeProcesses}
              className="py-1.5 px-3 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
              title="Clear accumulated process history"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'geo') {
    return (
      <div className="pt-2 flex flex-col lg:flex-row items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setGeoSubTab('live')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              geoSubTab === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span>Live Real-time</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-emerald-300 font-mono border border-emerald-500/30">
              {liveGeoCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setGeoSubTab('cumulative')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              geoSubTab === 'cumulative'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Cumulative Total</span>
            <span className="px-1.5 py-0.2 text-[10px] bg-slate-900 rounded-full text-cyan-300 font-mono border border-cyan-500/30">
              {cumulativeGeoCount > 0 ? cumulativeGeoCount : liveGeoCount}
            </span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <span className="text-[11px] font-mono text-emerald-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 hidden xl:inline-block shrink-0">
            Source PC: {myPublicGeo.countryCode} ({myPublicGeo.country})
          </span>
          <div className="relative w-full sm:w-44">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Country..."
              value={geoSearchTerm}
              onChange={(e) => setGeoSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="relative w-full sm:w-auto flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <select
              value={geoSortOption}
              onChange={(e) => setGeoSortOption(e.target.value as GeoSortOptionKey)}
              className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer border-none p-0 pr-1"
            >
              <option value="ips-desc" className="bg-slate-900 text-slate-200">
                Active IPs (Highest First)
              </option>
              <option value="ips-asc" className="bg-slate-900 text-slate-200">
                Active IPs (Lowest First)
              </option>
              <option value="bytes-desc" className="bg-slate-900 text-slate-200">
                Volume (Highest First)
              </option>
              <option value="bytes-asc" className="bg-slate-900 text-slate-200">
                Volume (Lowest First)
              </option>
              <option value="country-asc" className="bg-slate-900 text-slate-200">
                Country Name (A-Z)
              </option>
            </select>
          </div>
          {geoSubTab === 'cumulative' && onClearCumulativeGeoNodes && (
            <button
              type="button"
              onClick={onClearCumulativeGeoNodes}
              className="py-1.5 px-3 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
              title="Clear accumulated geo node history"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
