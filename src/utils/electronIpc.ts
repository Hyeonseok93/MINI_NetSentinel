/** Safe access to Electron preload bridge from the renderer. */
import type { IpcChannel } from '../ipc/channels';
import { showAppToast } from '../ui/toastBus';

export type ElectronIpcBridge = {
  /** Channel must be in shared/ipc-channels.json (typed via src/ipc/channels.ts). */
  invoke: (channel: IpcChannel, ...args: unknown[]) => Promise<any>;
  onWindowState?: (handler: (payload: { maximized?: boolean; float?: boolean }) => void) => () => void;
};

const warnedFeatures = new Set<string>();

export function isElectronShell(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if ((window as unknown as { electronIPC?: ElectronIpcBridge }).electronIPC) return true;
    return typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

export function getElectronIpc(): ElectronIpcBridge | null {
  try {
    if (typeof window === 'undefined') return null;
    return (window as unknown as { electronIPC?: ElectronIpcBridge }).electronIPC || null;
  } catch {
    return null;
  }
}

/** Toast once per session when running in Electron without the preload bridge. */
export function warnIpcUnavailable(feature: string): void {
  if (!isElectronShell()) return;
  if (warnedFeatures.has('__bridge__')) return;
  warnedFeatures.add('__bridge__');
  const label = feature.trim() || 'Desktop features';
  showAppToast(
    'IPC bridge missing',
    `${label} need the Electron preload bridge. Rebuild with npm run build:exe.`,
    'danger'
  );
}

/** Like getElectronIpc, but surfaces a toast in the Electron shell when missing. */
export function getElectronIpcOrWarn(feature: string): ElectronIpcBridge | null {
  const ipc = getElectronIpc();
  if (ipc) return ipc;
  warnIpcUnavailable(feature);
  return null;
}

export function invokeElectron(channel: IpcChannel, ...args: unknown[]): Promise<any> {
  const ipc = getElectronIpcOrWarn(channel);
  if (!ipc) {
    return Promise.reject(new Error(`IPC unavailable: ${channel}`));
  }
  return ipc.invoke(channel, ...args);
}
