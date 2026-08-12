/// <reference types="vite/client" />

interface ElectronIPCBridge {
  invoke(channel: string, ...args: unknown[]): Promise<any>;
}

interface Window {
  electronIPC?: ElectronIPCBridge;
}
