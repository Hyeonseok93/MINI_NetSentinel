import { getElectronIpc } from '../../utils/electronIpc';
import type { NativeIpSession } from './nativeSession';
import type { ProcessTrafficPoint } from '../../types/network';

export type ConnectionStatus = {
  mode: 'electron' | 'vite-dev' | 'offline';
  ok: boolean;
  lastError: string | null;
  lastSuccessAt: string | null;
  captureMode: 'npcap' | 'netstat' | 'unknown';
};

export type LiveTelemetryFetchResult = {
  sessions: NativeIpSession[];
  processes: ProcessTrafficPoint[] | null;
  connectionStatus: ConnectionStatus;
  reconcileActive: boolean;
};

/**
 * Fetch one telemetry tick from Electron IPC, else Vite /api/live-netstat.
 * Does not mutate engine state — caller applies the result.
 */
export async function fetchLiveTelemetry(
  prev: ConnectionStatus
): Promise<LiveTelemetryFetchResult> {
  let sessions: NativeIpSession[] = [];
  let processes: ProcessTrafficPoint[] | null = null;
  let gotPayload = false;
  let reconcileActive = false;
  let connectionStatus = { ...prev };

  const ipc = getElectronIpc();
  if (ipc) {
    try {
      const data = await ipc.invoke('get-live-netstat');
      if (data && typeof data === 'object') {
        gotPayload = true;
        reconcileActive = data.ok !== false;
        if (Array.isArray(data.sessions)) sessions = data.sessions;
        if (Array.isArray(data.processes)) processes = data.processes;

        if (data.ok === false) {
          connectionStatus = {
            mode: 'electron',
            ok: false,
            lastError: data.error || 'Electron telemetry returned ok:false',
            lastSuccessAt: prev.lastSuccessAt,
            captureMode:
              data.captureMode === 'npcap'
                ? 'npcap'
                : data.captureMode === 'netstat'
                  ? 'netstat'
                  : prev.captureMode,
          };
        } else {
          connectionStatus = {
            mode: 'electron',
            ok: true,
            lastError: data.captureError || null,
            lastSuccessAt: new Date().toISOString(),
            captureMode: data.captureMode === 'npcap' ? 'npcap' : 'netstat',
          };
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      connectionStatus = {
        mode: 'electron',
        ok: false,
        lastError: message,
        lastSuccessAt: prev.lastSuccessAt,
        captureMode: prev.captureMode,
      };
      console.error('[packet-engine] Electron IPC failed:', err);
    }
  }

  if (!gotPayload) {
    try {
      const response = await fetch('/api/live-netstat');
      if (response.ok) {
        const data = await response.json();
        gotPayload = true;
        reconcileActive = data.ok !== false;
        if (Array.isArray(data.sessions)) sessions = data.sessions;
        else if (Array.isArray(data)) sessions = data;
        if (Array.isArray(data.processes)) processes = data.processes;

        connectionStatus = {
          mode: 'vite-dev',
          ok: data.ok !== false,
          lastError: data.error || data.captureError || null,
          lastSuccessAt: data.ok === false ? prev.lastSuccessAt : new Date().toISOString(),
          captureMode: data.captureMode === 'npcap' ? 'npcap' : 'netstat',
        };
      } else {
        connectionStatus = {
          mode: 'offline',
          ok: false,
          lastError: `Vite /api/live-netstat HTTP ${response.status}`,
          lastSuccessAt: prev.lastSuccessAt,
          captureMode: prev.captureMode,
        };
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No Electron IPC and no Vite /api/live-netstat';
      connectionStatus = {
        mode: 'offline',
        ok: false,
        lastError: message,
        lastSuccessAt: prev.lastSuccessAt,
        captureMode: prev.captureMode,
      };
    }
  }

  return {
    sessions,
    processes,
    connectionStatus,
    reconcileActive: gotPayload && reconcileActive,
  };
}
