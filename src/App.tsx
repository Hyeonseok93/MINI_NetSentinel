import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { TrafficChart } from './components/TrafficChart';
import { AnomalyLog } from './components/AnomalyLog';
import { SettingsModal } from './components/SettingsModal';
import { TrustedManagerModal } from './components/TrustedManagerModal';
import { EnterpriseHubCard } from './components/EnterpriseHubCard';
import { realPacketEngine as packetEngine } from './services/realPacketEngine';
import { IpSession, AnomalyEvent, TrafficHistoryPoint, MonitoringConfig } from './types/network';

export function App() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [sessions, setSessions] = useState<IpSession[]>([]);
  const [history, setHistory] = useState<TrafficHistoryPoint[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrustedHubOpen, setIsTrustedHubOpen] = useState(false);

  const [config, setConfig] = useState<MonitoringConfig>({
    isMonitoring: true,
    spikeThresholdPacketsPerSec: 40,
    notifyOnNewIp: true,
    autoBlockSuspicious: true,
    refreshIntervalMs: 1000,
    activeInterface: 'Ethernet 0 (Intel(R) Ethernet Connection)',
  });

  useEffect(() => {
    packetEngine.start(config.refreshIntervalMs);

    const unsubscribe = packetEngine.subscribe(() => {
      setSessions(packetEngine.getSessions());
      setHistory(packetEngine.getHistory());
      setAnomalies(packetEngine.getAnomalies());
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
  const totalPackets = sessions.reduce((acc, curr) => acc + curr.totalPackets, 0);
  const totalBytes = sessions.reduce((acc, curr) => acc + curr.totalBytes, 0);
  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved);
  const trustedList = packetEngine.getTrustedList();
  const verifiedNormalList = packetEngine.getConfirmedNormalList();
  const processBreakdown = packetEngine.getProcessBreakdown();
  const cumulativeProcessBreakdown = packetEngine.getCumulativeProcessBreakdown();
  const geoNodes = packetEngine.getGeoNodes();
  const cumulativeGeoNodes = packetEngine.getCumulativeGeoNodes();

  // Daily Quota: 10 GB limit for demonstration
  const dailyQuotaBytes = 10 * 1024 * 1024 * 1024;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <Navbar
        isMonitoring={isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTrustedHub={() => setIsTrustedHubOpen(true)}
        unresolvedAnomaliesCount={unresolvedAnomalies.length}
        trustedCount={trustedList.length}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Summary Cards */}
        <StatsCards
          totalIps={sessions.length}
          totalPackets={totalPackets}
          totalBytes={totalBytes}
          anomaliesCount={unresolvedAnomalies.length}
        />

        {/* Real-time Traffic Flow Rate Graph */}
        <TrafficChart data={history} />

        {/* Active Security Alerts Audit Feed */}
        <AnomalyLog anomalies={anomalies} onResolve={handleResolveAnomaly} />

        {/* Unified Main Telemetry Hub Card (Shared Max Height & Scrollbar with Tab Switching) */}
        <EnterpriseHubCard
          sessions={sessions}
          processes={processBreakdown}
          cumulativeProcesses={cumulativeProcessBreakdown}
          geoNodes={geoNodes}
          cumulativeGeoNodes={cumulativeGeoNodes}
          currentBytesToday={totalBytes}
          dailyQuotaBytes={dailyQuotaBytes}
          onToggleBaseline={handleToggleBaseline}
          onVerifyNormal={handleVerifyNormal}
          onToggleBlock={handleToggleBlockIp}
          onClearCumulativeProcesses={() => packetEngine.clearCumulativeProcesses()}
          onClearCumulativeGeoNodes={() => packetEngine.clearCumulativeGeoNodes()}
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
          setConfig(newConfig);
          setIsMonitoring(newConfig.isMonitoring);
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
    </div>
  );
}

export default App;
