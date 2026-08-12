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
import { IpSession, AnomalyEvent, TrafficHistoryPoint, MonitoringConfig, BlacklistedIpItem } from './types/network';

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

  const [config, setConfig] = useState<MonitoringConfig>({
    isMonitoring: true,
    spikeThresholdPacketsPerSec: 40,
    notifyOnNewIp: true,
    autoBlockSuspicious: true,
    refreshIntervalMs: 1000,
    activeInterface: '',
    dailyQuotaValue: 10,
    dailyQuotaUnit: 'GB',
  });

  useEffect(() => {
    // Empty activeInterface = let Npcap auto-pick; do not push a fake adapter name.
    packetEngine.applyMonitoringConfig({
      spikeThresholdPacketsPerSec: config.spikeThresholdPacketsPerSec,
      notifyOnNewIp: config.notifyOnNewIp,
      autoBlockSuspicious: config.autoBlockSuspicious,
    });

    const ipc = typeof window !== 'undefined' ? window.electronIPC : null;
    if (!ipc?.invoke) return;
    ipc
      .invoke('capture-status')
      .then((status: { deviceName?: string; device?: string }) => {
        const picked = status?.deviceName || status?.device || '';
        if (picked) {
          setConfig((prev) =>
            prev.activeInterface ? prev : { ...prev, activeInterface: picked }
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isMonitoring) {
      packetEngine.stop();
      return;
    }

    packetEngine.start(config.refreshIntervalMs);

    const unsubscribe = packetEngine.subscribe(() => {
      setSessions(packetEngine.getSessions());
      // Copy so React/Recharts see a new reference (engine mutates the same array in place)
      setHistory([...packetEngine.getTrafficHistory()]);
      setAnomalies(packetEngine.getAnomalyEvents());
      setBlacklistedIps(packetEngine.getBlacklistedIps());
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <Navbar
        isMonitoring={isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTrustedHub={() => setIsTrustedHubOpen(true)}
        onOpenBlacklist={() => setIsBlacklistOpen(true)}
        onExportReport={handleExportReport}
        unresolvedAnomaliesCount={unresolvedAnomalies.length}
        trustedCount={trustedList.length}
        blacklistedCount={blacklistedIps.length}
        connectionMode={connectionStatus.mode}
        connectionOk={connectionStatus.ok}
        connectionError={connectionStatus.lastError}
        captureMode={connectionStatus.captureMode}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
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

        {/* Active Security Alerts Audit Feed */}
        <AnomalyLog anomalies={currentAnomalies} onResolve={handleResolveAnomaly} />

        {/* Unified Main Telemetry Hub Card (Shared Max Height & Scrollbar with Tab Switching) */}
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
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>NetSentinel &copy; 2026 — Real-time Packet & Anomaly Sentinel Enterprise</p>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={(newConfig) => {
          // Keep Navbar pause/resume as source of truth; Settings has no monitoring toggle
          setConfig({ ...newConfig, isMonitoring });
          packetEngine.applyMonitoringConfig({
            spikeThresholdPacketsPerSec: newConfig.spikeThresholdPacketsPerSec,
            notifyOnNewIp: newConfig.notifyOnNewIp,
            autoBlockSuspicious: newConfig.autoBlockSuspicious,
            ...(newConfig.activeInterface
              ? { activeInterface: newConfig.activeInterface }
              : {}),
          });
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
      />

      {/* Firewall Blacklist Manager Modal */}
      <BlacklistManagerModal
        isOpen={isBlacklistOpen}
        onClose={() => setIsBlacklistOpen(false)}
        blacklistedIps={blacklistedIps}
        onUnblockIp={(ip) => packetEngine.unblockIp(ip)}
        onAddBlockIp={(ip, reason) => packetEngine.blockIp(ip, reason)}
      />
    </div>
  );
}

export default App;
