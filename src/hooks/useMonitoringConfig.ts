import { useCallback, useEffect, useState } from 'react';
import type { MonitoringConfig } from '../types/network';
import { getElectronIpcOrWarn } from '../utils/electronIpc';
import { realPacketEngine as packetEngine } from '../services/realPacketEngine';

const CONFIG_STORAGE_KEY = 'netsentinel-monitoring-config-v2';

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
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
    if (!raw) return { ...DEFAULT_MONITORING_CONFIG };
    const parsed = JSON.parse(raw) as Partial<MonitoringConfig> & { isMonitoring?: boolean };
    const { isMonitoring: _ignored, ...rest } = parsed;
    return { ...DEFAULT_MONITORING_CONFIG, ...rest };
  } catch {
    return { ...DEFAULT_MONITORING_CONFIG };
  }
}

function persistConfig(next: MonitoringConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

function applyToEngine(next: MonitoringConfig) {
  packetEngine.applyMonitoringConfig({
    spikeThresholdPacketsPerSec: next.spikeThresholdPacketsPerSec,
    historySpikePacketsPerSec: next.historySpikePacketsPerSec,
    notifyOnNewIp: next.notifyOnNewIp,
    autoBlockSuspicious: next.autoBlockSuspicious,
    ...(next.activeInterface ? { activeInterface: next.activeInterface } : {}),
  });
}

export function useMonitoringConfig() {
  const [config, setConfig] = useState<MonitoringConfig>(() => loadStoredConfig());

  useEffect(() => {
    applyToEngine(config);

    const ipc = getElectronIpcOrWarn('Capture settings');
    if (!ipc?.invoke) return;
    ipc
      .invoke('capture-status')
      .then((status: { deviceName?: string; device?: string }) => {
        const picked = status?.deviceName || status?.device || '';
        if (!picked) return;
        setConfig((prev) => {
          if (prev.activeInterface) return prev;
          const next = { ...prev, activeInterface: picked };
          persistConfig(next);
          return next;
        });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, []);

  const saveConfig = useCallback((newConfig: MonitoringConfig) => {
    setConfig(newConfig);
    persistConfig(newConfig);
    applyToEngine(newConfig);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const next = { ...DEFAULT_MONITORING_CONFIG };
    setConfig(next);
    persistConfig(next);
    applyToEngine(next);
    const ipc = getElectronIpcOrWarn('Capture settings');
    if (ipc) {
      try {
        await ipc.invoke('set-capture-adapter', '');
      } catch {
        /* ignore */
      }
    }
  }, []);

  return { config, saveConfig, resetToDefaults };
}
