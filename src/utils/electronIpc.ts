/** Safe access to Electron preload bridge from the renderer. */

export type ElectronIpcBridge = {
  invoke: (channel: string, ...args: unknown[]) => Promise<any>;
  onToast?: (handler: (payload: { title?: string; body?: string }) => void) => () => void;
};

export function getElectronIpc(): ElectronIpcBridge | null {
  try {
    if (typeof window === 'undefined') return null;
    return (window as any).electronIPC || null;
  } catch {
    return null;
  }
}
