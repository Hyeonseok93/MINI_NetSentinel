import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { TrafficChart } from './components/TrafficChart';
import { AnomalyLog } from './components/AnomalyLog';
import { SettingsModal } from './components/SettingsModal';
import { TrustedManagerModal } from './components/TrustedManagerModal';
import { BlacklistManagerModal } from './components/BlacklistManagerModal';
import { BandwidthGaugeCard } from './components/BandwidthGaugeCard';
import { EnterpriseHubCard } from './components/EnterpriseHubCard';
import { realPacketEngine as packetEngine } from './services/realPacketEngine';
import { exportAuditReportCsv } from './utils/reportExporter';
import { getElectronIpc } from './utils/electronIpc';
import { IpSession, AnomalyEvent, TrafficHistoryPoint, MonitoringConfig, BlacklistedIpItem, SpikeHistoryEntry } from './types/network';
import { Activity, ShieldAlert, History } from 'lucide-react';
import { HistoryFeed } from './components/HistoryFeed';
import { ConfirmHost } from './components/ConfirmHost';
import { ToastHost } from './components/ToastHost';
import { showAppToast } from './ui/toastBus';

const CONFIG_STORAGE_KEY = 'netsentinel-monitoring-config-v2';

const DEFAULT_CONFIG: MonitoringConfig = {
  isMonitoring: true,
  spikeThresholdPacketsPerSec: 40,
  historySpikePacketsPerSec: 200,
  notifyOnNewIp: false,
  autoBlockSuspicious: false,
  refreshIntervalMs: 1000,
  activeInterface: '',
  dailyQuotaValue: 10,
  dailyQuotaUnit: 'GB',
};

function loadStoredConfig(): MonitoringConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<MonitoringConfig>;
    return { ...DEFAULT_CONFIG, ...parsed, isMonitoring: true };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function persistConfig(config: MonitoringConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore quota / private mode
  }
}

export function App() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [sessions, setSessions] = useState<IpSession[]>([]);
  const [history, setHistory] = useState<TrafficHistoryPoint[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [blacklistedIps, setBlacklistedIps] = useState<BlacklistedIpItem[]>([]);
  const [tick, setTick] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrustedHubOpen, setIsTrustedHubOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [mainSection, setMainSection] = useState<'hub' | 'anomalies' | 'history'>('hub');
  const [spikeHistory, setSpikeHistory] = useState<SpikeHistoryEntry[]>([]);

  const [config, setConfig] = useState<MonitoringConfig>(() => loadStoredConfig());

  useEffect(() => {
    // Empty activeInterface = let Npcap auto-pick; do not push a fake adapter name.
    packetEngine.applyMonitoringConfig({
      spikeThresholdPacketsPerSec: config.spikeThresholdPacketsPerSec,
      historySpikePacketsPerSec: config.historySpikePacketsPerSec,
      notifyOnNewIp: config.notifyOnNewIp,
      autoBlockSuspicious: config.autoBlockSuspicious,
      ...(config.activeInterface ? { activeInterface: config.activeInterface } : {}),
    });

    const ipc = getElectronIpc();
    if (!ipc?.invoke) return;
    ipc
      .invoke('capture-status')
      .then((status: { deviceName?: string; device?: string }) => {
        const picked = status?.deviceName || status?.device || '';
        if (picked) {
          setConfig((prev) => {
            if (prev.activeInterface) return prev;
            const next = { ...prev, activeInterface: picked };
            persistConfig(next);
            return next;
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const ipc = getElectronIpc();
    if (!ipc?.onToast) return;
    return ipc.onToast((payload) => {
      showAppToast(payload?.title || 'NetSentinel', payload?.body || '', 'info');
    });
  }, []);

  useEffect(() => {
    if (!isMonitoring) {
      packetEngine.stop();
      return;
    }

    packetEngine.start(config.refreshIntervalMs);

    const unsubscribe = packetEngine.subscribe(() => {
      setSessions(packetEngine.getSessions());
      // Engine already returns a capped copy (last ~1h for chart UI)
      setHistory(packetEngine.getTrafficHistory());
      setAnomalies(packetEngine.getAnomalyEvents());
      setBlacklistedIps(packetEngine.getBlacklistedIps());
      setSpikeHistory(packetEngine.getSpikeHistory());
      setTick((t) => t + 1);
    });

    return () => {
      unsubscribe();
      packetEngine.stop();
    };
  }, [isMonitoring, config.refreshIntervalMs]);

  const handleToggleMonitoring = () => {
    setIsMonitoring(!isMonitoring);
  };

  const handleToggleBaseline = (ip: string) => {
    packetEngine.toggleBaseline(ip);
  };

  const handleVerifyNormal = (ip: string) => {
    packetEngine.verifyAsNormal(ip);
  };

  const handleToggleBlockIp = (ip: string) => {
    packetEngine.toggleBlockIp(ip);
  };

  const handleResolveAnomaly = (id: string) => {
    packetEngine.resolveAnomaly(id);
  };

  const handleDeleteAnomaly = (id: string) => {
    packetEngine.deleteAnomaly(id);
  };

  const handleClearResolvedAnomalies = () => {
    packetEngine.clearResolvedAnomalies();
  };

  // Calculations & Enterprise Telemetry Data
  // tick forces re-read of derived engine getters (processes/geo/trusted) on each notify
  void tick;
  const currentSessions = sessions;
  const currentAnomalies = anomalies;
  const totalPackets = currentSessions.reduce((acc, curr) => acc + curr.totalPackets, 0);
  const totalBytes = currentSessions.reduce((acc, curr) => acc + curr.totalBytes, 0);
  const unresolvedAnomalies = currentAnomalies.filter((a) => !a.resolved);
  const connectionStatus = packetEngine.getConnectionStatus();
  const trustedList = packetEngine.getTrustedList();
  const verifiedNormalList = packetEngine.getConfirmedNormalList();
  const processBreakdown = packetEngine.getProcessBreakdown();
  const cumulativeProcessBreakdown = packetEngine.getCumulativeProcessBreakdown();
  const geoNodes = packetEngine.getGeoNodes();
  const cumulativeGeoNodes = packetEngine.getCumulativeGeoNodes();

  // Dynamic Daily Quota Limit with Unit Conversion (KB, MB, GB, TB)
  const quotaVal = config.dailyQuotaValue || 10;
  const unit = config.dailyQuotaUnit || 'GB';
  const quotaUnitMultiplier =
    unit === 'KB'
      ? 1024
      : unit === 'MB'
      ? 1024 * 1024
      : unit === 'GB'
      ? 1024 * 1024 * 1024
      : 1024 * 1024 * 1024 * 1024; // TB
  const dailyQuotaBytes = quotaVal * quotaUnitMultiplier;

  const handleExportReport = () => {
    const allSessions = packetEngine.getSessions();
    const allProcesses = packetEngine.getGroupedCumulativeProcesses();
    const allGeoNodes = packetEngine.getCumulativeGeoNodes();
    exportAuditReportCsv(allSessions, allProcesses, allGeoNodes);
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Integrated desktop title bar + toolbar */}
      <Navbar
        isMonitoring={isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTrustedHub={() => setIsTrustedHubOpen(true)}
        onOpenBlacklist={() => setIsBlacklistOpen(true)}
        onExportReport={handleExportReport}
        trustedCount={trustedList.length}
        blacklistedCount={blacklistedIps.length}
        connectionMode={connectionStatus.mode}
        connectionOk={connectionStatus.ok}
        connectionError={connectionStatus.lastError}
        captureMode={connectionStatus.captureMode}
      />

      {/* Main Content Body — only this region scrolls */}
      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-5 py-5 space-y-5">
        {/* KPI Summary Cards */}
        <StatsCards
          totalIps={currentSessions.length}
          totalPackets={totalPackets}
          totalBytes={totalBytes}
          anomaliesCount={unresolvedAnomalies.length}
        />

        {/* Real-time Dual Bandwidth Speed Gauges & Top 5 Process Traffic Ranking */}
        <BandwidthGaugeCard
          processes={packetEngine.getGroupedCumulativeProcesses()}
          history={history}
        />

        {/* Real-time Traffic Flow Rate Graph */}
        <TrafficChart data={history} />

        {/* Top-level section: Network Hub vs Anomaly Feed (50/50 full width) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 w-full">
          <button
            type="button"
            onClick={() => setMainSection('hub')}
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
            onClick={() => setMainSection('anomalies')}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mainSection === 'anomalies'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Anomaly Feed
            {unresolvedAnomalies.length > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full">
                {unresolvedAnomalies.length > 99 ? '99+' : unresolvedAnomalies.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMainSection('history')}
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
          <EnterpriseHubCard
            sessions={currentSessions}
            processes={processBreakdown}
            cumulativeProcesses={cumulativeProcessBreakdown}
            geoNodes={geoNodes}
            cumulativeGeoNodes={cumulativeGeoNodes}
            myPublicGeo={packetEngine.getMyPublicGeo()}
            currentBytesToday={totalBytes}
            dailyQuotaBytes={dailyQuotaBytes}
            onToggleBaseline={handleToggleBaseline}
            onVerifyNormal={handleVerifyNormal}
            onToggleBlock={handleToggleBlockIp}
            onClearCumulativeProcesses={() => packetEngine.clearCumulativeProcesses()}
            onClearCumulativeGeoNodes={() => packetEngine.clearCumulativeGeoNodes()}
            getCumulativeGeoSessions={(country: string) => packetEngine.getCumulativeGeoSessions(country)}
          />
        ) : mainSection === 'anomalies' ? (
          <AnomalyLog
            anomalies={currentAnomalies}
            onResolve={handleResolveAnomaly}
            onDelete={handleDeleteAnomaly}
            onClearResolved={handleClearResolvedAnomalies}
            expanded
          />
        ) : (
          <HistoryFeed
            entries={spikeHistory}
            onClear={() => packetEngine.clearSpikeHistory()}
            onDelete={(id) => packetEngine.deleteSpikeHistory(id)}
          />
        )}
      </div>
      </main>

      <footer className="shrink-0 py-2 border-t border-slate-900/80 text-center text-[10px] text-slate-600 bg-slate-950">
        <p>NetSentinel &copy; 2026 — Packet & Anomaly Sentinel</p>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={(newConfig) => {
          // Keep Navbar pause/resume as source of truth; Settings has no monitoring toggle
          const next = { ...newConfig, isMonitoring };
          setConfig(next);
          persistConfig(next);
          packetEngine.applyMonitoringConfig({
            spikeThresholdPacketsPerSec: newConfig.spikeThresholdPacketsPerSec,
            historySpikePacketsPerSec: newConfig.historySpikePacketsPerSec,
            notifyOnNewIp: newConfig.notifyOnNewIp,
            autoBlockSuspicious: newConfig.autoBlockSuspicious,
            ...(newConfig.activeInterface
              ? { activeInterface: newConfig.activeInterface }
              : {}),
          });
        }}
        onResetToDefaults={async () => {
          const next = { ...DEFAULT_CONFIG, isMonitoring };
          setConfig(next);
          persistConfig(next);
          packetEngine.applyMonitoringConfig({
            spikeThresholdPacketsPerSec: next.spikeThresholdPacketsPerSec,
            historySpikePacketsPerSec: next.historySpikePacketsPerSec,
            notifyOnNewIp: next.notifyOnNewIp,
            autoBlockSuspicious: next.autoBlockSuspicious,
            activeInterface: '',
          });
          await packetEngine.resetAllMonitoringState();
        }}
      />

      {/* Security Verification & Whitelist Hub Modal */}
      <TrustedManagerModal
        isOpen={isTrustedHubOpen}
        onClose={() => setIsTrustedHubOpen(false)}
        trustedList={trustedList}
        verifiedNormalList={verifiedNormalList}
        onRemoveTrusted={(ip) => packetEngine.removeTrustedIp(ip)}
        onAddTrusted={(ip, domain) => packetEngine.addTrustedIp(ip, domain)}
        onAddVerifiedNormal={(ip, domain) => packetEngine.addVerifiedNormalIp(ip, domain)}
        onPromoteToBaseline={(ip) => packetEngine.toggleBaseline(ip)}
        onResetNormalStatus={(ip) => packetEngine.resetNormalStatus(ip)}
        onResetTrustedList={() => packetEngine.clearTrustedList()}
        onResetVerifiedList={() => packetEngine.clearVerifiedList()}
      />

      {/* Firewall Blacklist Manager Modal */}
      <BlacklistManagerModal
        isOpen={isBlacklistOpen}
        onClose={() => setIsBlacklistOpen(false)}
        blacklistedIps={blacklistedIps}
        onUnblockIp={(ip) => packetEngine.unblockIp(ip)}
        onAddBlockIp={(ip, reason) => packetEngine.blockIp(ip, reason)}
        onResetBlacklist={() => packetEngine.clearBlacklist()}
      />

      <ConfirmHost />
      <ToastHost />
    </div>
  );
}

export default App;
