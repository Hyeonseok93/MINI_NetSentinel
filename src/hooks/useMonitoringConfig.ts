import { useCallback, useEffect, useState } from 'react';
import type { MonitoringConfig } from '../types/network';
import { getElectronIpcOrWarn } from '../utils/electronIpc';
import { realPacketEngine as packetEngine } from '../services/realPacketEngine';
import { userStoreGet, userStoreSet } from '../services/userStore';

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  spikeThresholdPacketsPerSec: 40,
  historySpikePacketsPerSec: 200,
  notifyOnNewIp: false,
  refreshIntervalMs: 1000,
  activeInterface: '',
  dailyQuotaValue: 10,
  dailyQuotaUnit: 'GB',
};

function normalizeConfig(raw: unknown): MonitoringConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MONITORING_CONFIG };
  return { ...DEFAULT_MONITORING_CONFIG, ...(raw as Partial<MonitoringConfig>) };
}

async function loadStoredConfig(): Promise<MonitoringConfig> {
  try {
    return normalizeConfig(await userStoreGet('monitoring-config'));
  } catch {
    return { ...DEFAULT_MONITORING_CONFIG };
  }
}

async function persistConfig(next: MonitoringConfig): Promise<void> {
  try {
    await userStoreSet('monitoring-config', next);
  } catch {
    /* ignore */
  }
}

function applyToEngine(next: MonitoringConfig) {
  packetEngine.applyMonitoringConfig({
    spikeThresholdPacketsPerSec: next.spikeThresholdPacketsPerSec,
    historySpikePacketsPerSec: next.historySpikePacketsPerSec,
    notifyOnNewIp: next.notifyOnNewIp,
    ...(next.activeInterface ? { activeInterface: next.activeInterface } : {}),
  });
}

export function useMonitoringConfig() {
  const [config, setConfig] = useState<MonitoringConfig>(() => ({ ...DEFAULT_MONITORING_CONFIG }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadStoredConfig();
      if (cancelled) return;
      setConfig(loaded);
      applyToEngine(loaded);

      const ipc = getElectronIpcOrWarn('Capture settings');
      if (!ipc?.invoke) return;
      try {
        const status = (await ipc.invoke('capture-status')) as {
          deviceName?: string;
          device?: string;
        };
        const picked = status?.deviceName || status?.device || '';
        if (!picked || cancelled) return;
        setConfig((prev) => {
          if (prev.activeInterface) return prev;
          const next = { ...prev, activeInterface: picked };
          void persistConfig(next);
          return next;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveConfig = useCallback((newConfig: MonitoringConfig) => {
    setConfig(newConfig);
    void persistConfig(newConfig);
    applyToEngine(newConfig);
  }, []);

  const resetToDefaults = useCallback(async () => {
    const next = { ...DEFAULT_MONITORING_CONFIG };
    setConfig(next);
    await persistConfig(next);
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
