import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { StatsCards } from './components/StatsCards';
import { TrafficChart } from './components/TrafficChart';
import { BandwidthGaugeCard } from './components/BandwidthGaugeCard';
import { AppModals } from './components/AppModals';
import { MainSectionTabs } from './components/MainSectionTabs';
import { ConfirmHost } from './components/ConfirmHost';
import { ToastHost } from './components/ToastHost';
import { FloatingHud } from './components/FloatingHud';
import { exportAuditReportCsv } from './utils/reportExporter';
import { groupProcessesByName, sortGroupedProcessesByBytesDesc } from './utils/groupProcesses';
import { quotaToBytes } from './utils/formatters';
import { latestTrafficRates } from './utils/trafficRates';
import { useMonitoringConfig } from './hooks/useMonitoringConfig';
import { useFloatMode } from './hooks/useFloatMode';
import { usePacketEngineSnapshot } from './hooks/usePacketEngineSnapshot';
import { createPacketEngineActions } from './services/packetEngineActions';

const engineActions = createPacketEngineActions();

export function App() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTrustedHubOpen, setIsTrustedHubOpen] = useState(false);
  const [isBlacklistOpen, setIsBlacklistOpen] = useState(false);
  const [mainSection, setMainSection] = useState<'hub' | 'anomalies' | 'history'>('hub');

  const { config, saveConfig, resetToDefaults } = useMonitoringConfig();
  const { isFloatMode, enterFloatMode, exitFloatMode } = useFloatMode();
  const snap = usePacketEngineSnapshot(isMonitoring, config.refreshIntervalMs);

  const handleToggleMonitoring = () => setIsMonitoring(!isMonitoring);

  const totalPackets = snap.sessions.reduce((acc, curr) => acc + curr.totalPackets, 0);
  const totalBytes = snap.sessions.reduce((acc, curr) => acc + curr.totalBytes, 0);
  const unresolvedAnomalies = snap.anomalies.filter((a) => !a.resolved);
  const dailyQuotaBytes = quotaToBytes(config.dailyQuotaValue || 10, config.dailyQuotaUnit || 'GB');
  const { rxBytesPerSec, txBytesPerSec } = latestTrafficRates(snap.history);

  const topProcess =
    sortGroupedProcessesByBytesDesc(groupProcessesByName(snap.processBreakdown))[0] ?? null;
  const topSession =
    [...snap.sessions].sort((a, b) => b.totalBytes - a.totalBytes)[0] ?? null;

  const handleExportReport = () => {
    exportAuditReportCsv(
      snap.sessions,
      snap.groupedCumulativeProcesses,
      snap.cumulativeGeoNodes
    );
  };

  if (isFloatMode) {
    return (
      <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans antialiased">
        <FloatingHud
          isMonitoring={isMonitoring}
          sessionCount={snap.sessions.length}
          anomalyCount={unresolvedAnomalies.length}
          rxBytesPerSec={rxBytesPerSec}
          txBytesPerSec={txBytesPerSec}
          history={snap.history}
          captureMode={snap.connectionStatus.captureMode}
          connectionOk={snap.connectionStatus.ok}
          topProcessName={topProcess?.processName ?? null}
          topProcessBytes={topProcess?.totalBytes ?? 0}
          topIp={topSession?.ip ?? null}
          topIpBytes={topSession?.totalBytes ?? 0}
          currentBytesToday={snap.bytesToday}
          dailyQuotaBytes={dailyQuotaBytes}
          onExpand={exitFloatMode}
          onToggleMonitoring={handleToggleMonitoring}
        />
        <ConfirmHost />
        <ToastHost />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      <Navbar
        isMonitoring={isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTrustedHub={() => setIsTrustedHubOpen(true)}
        onOpenBlacklist={() => setIsBlacklistOpen(true)}
        onExportReport={handleExportReport}
        blacklistedCount={snap.blacklistedIps.length}
        connectionMode={snap.connectionStatus.mode}
        connectionOk={snap.connectionStatus.ok}
        connectionError={snap.connectionStatus.lastError}
        captureMode={snap.connectionStatus.captureMode}
        onEnterFloat={enterFloatMode}
      />

      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-5 py-5 space-y-5">
          <StatsCards
            totalIps={snap.sessions.length}
            totalPackets={totalPackets}
            totalBytes={totalBytes}
            anomaliesCount={unresolvedAnomalies.length}
          />

          <BandwidthGaugeCard
            processes={sortGroupedProcessesByBytesDesc(
              groupProcessesByName(snap.processBreakdown)
            )}
            history={snap.history}
          />

          <TrafficChart data={snap.history} />

          <MainSectionTabs
            mainSection={mainSection}
            onSectionChange={setMainSection}
            sessions={snap.sessions}
            cumulativeSessions={snap.cumulativeSessions}
            anomalies={snap.anomalies}
            spikeHistory={snap.spikeHistory}
            processBreakdown={snap.processBreakdown}
            cumulativeProcessBreakdown={snap.cumulativeProcessBreakdown}
            geoNodes={snap.geoNodes}
            cumulativeGeoNodes={snap.cumulativeGeoNodes}
            myPublicGeo={snap.myPublicGeo}
            totalBytes={snap.bytesToday}
            dailyQuotaBytes={dailyQuotaBytes}
            unresolvedAnomalyCount={unresolvedAnomalies.length}
            actions={engineActions}
          />
        </div>
      </main>

      <footer className="shrink-0 py-2 border-t border-slate-900/80 text-center text-[10px] text-slate-600 bg-slate-950">
        <p>NetSentinel &copy; 2026 — personal network monitor</p>
      </footer>

      <AppModals
        isSettingsOpen={isSettingsOpen}
        onCloseSettings={() => setIsSettingsOpen(false)}
        isTrustedHubOpen={isTrustedHubOpen}
        onCloseTrustedHub={() => setIsTrustedHubOpen(false)}
        isBlacklistOpen={isBlacklistOpen}
        onCloseBlacklist={() => setIsBlacklistOpen(false)}
        config={config}
        onSaveConfig={saveConfig}
        onResetToDefaults={resetToDefaults}
        trustedList={snap.trustedList}
        verifiedNormalList={snap.verifiedNormalList}
        blacklistedIps={snap.blacklistedIps}
        actions={engineActions}
      />

      <ConfirmHost />
      <ToastHost />
    </div>
  );
}

export default App;
