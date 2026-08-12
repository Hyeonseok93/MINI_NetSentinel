/** Safe access to Electron preload bridge from the renderer. */
export function getElectronIpc(): { invoke: (channel: string, ...args: unknown[]) => Promise<any> } | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.electronIPC || null;
  } catch {
    return null;
  }
}
