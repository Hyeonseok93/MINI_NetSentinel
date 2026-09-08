import { useCallback, useEffect, useState } from 'react';
import type { MonitoringConfig } from '../types/network';
import { getElectronIpcOrWarn } from '../utils/electronIpc';
import { realPacketEngine as packetEngine } from '../services/realPacketEngine';
import { userStoreGet, userStoreSet } from '../services/userStore';
import {
  DEFAULT_REFRESH_INTERVAL_MS,
  MAX_REFRESH_INTERVAL_MS,
  MIN_HISTORY_SPIKE_PACKETS_PER_SEC,
  MIN_REFRESH_INTERVAL_MS,
} from '../services/packetEngine/limits';

const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  spikeThresholdPacketsPerSec: 40,
  historySpikePacketsPerSec: 200,
  notifyOnNewIp: false,
  refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  activeInterface: '',
  dailyQuotaValue: 10,
  dailyQuotaUnit: 'GB',
};

function clampRefreshIntervalMs(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_REFRESH_INTERVAL_MS;
  return Math.min(MAX_REFRESH_INTERVAL_MS, Math.max(MIN_REFRESH_INTERVAL_MS, Math.round(n)));
}

function normalizeConfig(raw: unknown): MonitoringConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MONITORING_CONFIG };
  const merged = { ...DEFAULT_MONITORING_CONFIG, ...(raw as Partial<MonitoringConfig>) };
  merged.refreshIntervalMs = clampRefreshIntervalMs(merged.refreshIntervalMs);
  if (typeof merged.historySpikePacketsPerSec === 'number') {
    merged.historySpikePacketsPerSec = Math.max(
      MIN_HISTORY_SPIKE_PACKETS_PER_SEC,
      Math.floor(merged.historySpikePacketsPerSec) || 200
    );
  }
  return merged;
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
    const next = normalizeConfig(newConfig);
    setConfig(next);
    void persistConfig(next);
    applyToEngine(next);
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
