import React, { useState } from 'react';
import { IpSession, ProcessTrafficPoint, GeoNode } from '../types/network';
import { HubSessionsTable } from './hub/HubSessionsTable';
import { HubAppsGrid } from './hub/HubAppsGrid';
import { HubGeoGrid } from './hub/HubGeoGrid';
import { HubQuotaPanel } from './hub/HubQuotaPanel';
import { HubTabBar } from './hub/HubTabBar';
import { HubTabControls } from './hub/HubTabControls';
import {
  filterAndSortSessions,
  groupAndSortProcesses,
  filterAndSortGeoNodes,
} from './hub/hubFilters';
import {
  MainTabKey,
  SortOptionKey,
  AppSortOptionKey,
  GeoSortOptionKey,
  SessionFilterType,
} from './hub/hubTypes';

interface EnterpriseHubCardProps {
  sessions: IpSession[];
  processes: ProcessTrafficPoint[];
  cumulativeProcesses?: ProcessTrafficPoint[];
  geoNodes: GeoNode[];
  cumulativeGeoNodes?: GeoNode[];
  myPublicGeo?: { country: string; countryCode: string };
  currentBytesToday: number;
  dailyQuotaBytes: number;
  onToggleBaseline: (ip: string) => void;
  onVerifyNormal: (ip: string) => void;
  onToggleBlock: (ip: string) => void;
  onClearCumulativeProcesses?: () => void;
  onClearCumulativeGeoNodes?: () => void;
  getCumulativeGeoSessions?: (country: string) => IpSession[];
}

export const EnterpriseHubCard: React.FC<EnterpriseHubCardProps> = ({
  sessions,
  processes,
  cumulativeProcesses = [],
  geoNodes,
  cumulativeGeoNodes = [],
  myPublicGeo = { country: 'South Korea', countryCode: 'KR' },
  currentBytesToday,
  dailyQuotaBytes,
  onToggleBaseline,
  onVerifyNormal,
  onToggleBlock,
  onClearCumulativeProcesses,
  onClearCumulativeGeoNodes,
  getCumulativeGeoSessions,
}) => {
  const [activeTab, setActiveTab] = useState<MainTabKey>('sessions');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<SessionFilterType>('all');
  const [sortOption, setSortOption] = useState<SortOptionKey>('packets-desc');
  const [appSubTab, setAppSubTab] = useState<'live' | 'cumulative'>('cumulative');
  const [appSearchTerm, setAppSearchTerm] = useState('');
  const [appSortOption, setAppSortOption] = useState<AppSortOptionKey>('bytes-desc');
  const [geoSubTab, setGeoSubTab] = useState<'live' | 'cumulative'>('live');
  const [geoSearchTerm, setGeoSearchTerm] = useState('');
  const [geoSortOption, setGeoSortOption] = useState<GeoSortOptionKey>('ips-desc');

  const filteredSessions = React.useMemo(
    () => filterAndSortSessions(sessions, searchTerm, filterType, sortOption),
    [sessions, searchTerm, filterType, sortOption]
  );

  const liveAppNames = new Set(processes.map((p) => p.processName));
  const cumulativeAppNames = new Set(cumulativeProcesses.map((p) => p.processName));
  const targetProcesses =
    appSubTab === 'cumulative'
      ? cumulativeProcesses.length > 0
        ? cumulativeProcesses
        : processes
      : processes;
  const groupedProcesses = groupAndSortProcesses(targetProcesses, appSearchTerm, appSortOption);
  const maxAppBytes = Math.max(
    ...groupedProcesses.map((g) => (appSubTab === 'live' ? Math.floor(g.totalBytes / 10) : g.totalBytes)),
    1
  );

  const targetGeoNodes =
    geoSubTab === 'cumulative'
      ? cumulativeGeoNodes.length > 0
        ? cumulativeGeoNodes
        : geoNodes
      : geoNodes;
  const filteredGeoNodes = filterAndSortGeoNodes(targetGeoNodes, geoSearchTerm, geoSortOption);

  const quotaPercent = Math.min(Math.round((currentBytesToday / dailyQuotaBytes) * 100), 100);
  const isQuotaWarning = quotaPercent >= 80;
  const isQuotaExceeded = quotaPercent >= 100;

  return (
    <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col space-y-0">
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 space-y-3">
        <HubTabBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sessionCount={filteredSessions.length}
          appCount={groupedProcesses.length}
          geoCount={filteredGeoNodes.length}
          quotaPercent={quotaPercent}
        />
        <HubTabControls
          activeTab={activeTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          sortOption={sortOption}
          setSortOption={setSortOption}
          appSubTab={appSubTab}
          setAppSubTab={setAppSubTab}
          appSearchTerm={appSearchTerm}
          setAppSearchTerm={setAppSearchTerm}
          appSortOption={appSortOption}
          setAppSortOption={setAppSortOption}
          liveAppCount={liveAppNames.size}
          cumulativeAppCount={cumulativeAppNames.size}
          onClearCumulativeProcesses={onClearCumulativeProcesses}
          geoSubTab={geoSubTab}
          setGeoSubTab={setGeoSubTab}
          geoSearchTerm={geoSearchTerm}
          setGeoSearchTerm={setGeoSearchTerm}
          geoSortOption={geoSortOption}
          setGeoSortOption={setGeoSortOption}
          liveGeoCount={geoNodes.length}
          cumulativeGeoCount={cumulativeGeoNodes.length}
          myPublicGeo={myPublicGeo}
          onClearCumulativeGeoNodes={onClearCumulativeGeoNodes}
        />
      </div>

      <div className="p-6 max-h-[800px] overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-3">
        {activeTab === 'sessions' && (
          <HubSessionsTable
            sessions={filteredSessions}
            onToggleBaseline={onToggleBaseline}
            onVerifyNormal={onVerifyNormal}
            onToggleBlock={onToggleBlock}
          />
        )}
        {activeTab === 'apps' && (
          <HubAppsGrid
            groupedProcesses={groupedProcesses}
            appSubTab={appSubTab}
            maxAppBytes={maxAppBytes}
          />
        )}
        {activeTab === 'geo' && (
          <HubGeoGrid
            filteredGeoNodes={filteredGeoNodes}
            sessions={sessions}
            geoSubTab={geoSubTab}
            getCumulativeGeoSessions={getCumulativeGeoSessions}
          />
        )}
        {activeTab === 'quota' && (
          <HubQuotaPanel
            currentBytesToday={currentBytesToday}
            dailyQuotaBytes={dailyQuotaBytes}
            quotaPercent={quotaPercent}
            isQuotaWarning={isQuotaWarning}
            isQuotaExceeded={isQuotaExceeded}
          />
        )}
      </div>
    </div>
  );
};
