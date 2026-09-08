import { Activity, History, ShieldAlert } from 'lucide-react';
import { AnomalyLog } from './AnomalyLog';
import { HubCard } from './HubCard';
import { HistoryFeed } from './HistoryFeed';
import type { PacketEngineActions } from '../services/packetEngineActions';
import type {
  AnomalyEvent,
  GeoNode,
  IpSession,
  ProcessTrafficPoint,
  SpikeHistoryEntry,
} from '../types/network';

type MainSection = 'hub' | 'anomalies' | 'history';

type Props = {
  mainSection: MainSection;
  onSectionChange: (section: MainSection) => void;
  sessions: IpSession[];
  cumulativeSessions: IpSession[];
  anomalies: AnomalyEvent[];
  spikeHistory: SpikeHistoryEntry[];
  processBreakdown: ProcessTrafficPoint[];
  cumulativeProcessBreakdown: ProcessTrafficPoint[];
  geoNodes: GeoNode[];
  cumulativeGeoNodes: GeoNode[];
  myPublicGeo: { country: string; countryCode: string };
  totalBytes: number;
  dailyQuotaBytes: number;
  unresolvedAnomalyCount: number;
  actions: PacketEngineActions;
};

export function MainSectionTabs({
  mainSection,
  onSectionChange,
  sessions,
  cumulativeSessions,
  anomalies,
  spikeHistory,
  processBreakdown,
  cumulativeProcessBreakdown,
  geoNodes,
  cumulativeGeoNodes,
  myPublicGeo,
  totalBytes,
  dailyQuotaBytes,
  unresolvedAnomalyCount,
  actions,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 w-full">
        <button
          type="button"
          onClick={() => onSectionChange('hub')}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            mainSection === 'hub'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Network Hub
        </button>
        <button
          type="button"
          onClick={() => onSectionChange('anomalies')}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            mainSection === 'anomalies'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Event log
          {unresolvedAnomalyCount > 0 && (
            <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full">
              {unresolvedAnomalyCount > 99 ? '99+' : unresolvedAnomalyCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onSectionChange('history')}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            mainSection === 'history'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          History
          {spikeHistory.length > 0 && (
            <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-amber-600 text-white rounded-full">
              {spikeHistory.length > 99 ? '99+' : spikeHistory.length}
            </span>
          )}
        </button>
      </div>

      {mainSection === 'hub' ? (
        <HubCard
          sessions={sessions}
          cumulativeSessions={cumulativeSessions}
          processes={processBreakdown}
          cumulativeProcesses={cumulativeProcessBreakdown}
          geoNodes={geoNodes}
          cumulativeGeoNodes={cumulativeGeoNodes}
          myPublicGeo={myPublicGeo}
          currentBytesToday={totalBytes}
          dailyQuotaBytes={dailyQuotaBytes}
          onToggleBaseline={actions.toggleBaseline}
          onVerifyNormal={actions.verifyAsNormal}
          onToggleBlock={actions.toggleBlockIp}
          onClearCumulativeProcesses={actions.clearCumulativeProcesses}
          onClearCumulativeGeoNodes={actions.clearCumulativeGeoNodes}
          onClearCumulativeSessions={actions.clearCumulativeSessions}
          getCumulativeGeoSessions={actions.getCumulativeGeoSessions}
        />
      ) : mainSection === 'anomalies' ? (
        <AnomalyLog
          anomalies={anomalies}
          onResolve={actions.resolveAnomaly}
          onDelete={actions.deleteAnomaly}
          onClearResolved={actions.clearResolvedAnomalies}
          expanded
        />
      ) : (
        <HistoryFeed
          entries={spikeHistory}
          onClear={actions.clearSpikeHistory}
          onDelete={actions.deleteSpikeHistory}
        />
      )}
    </>
  );
}
