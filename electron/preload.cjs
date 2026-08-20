const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronIPC', {
  invoke: (channel, ...args) => {
    const allowed = new Set([
      'get-live-netstat',
      'geoip-status',
      'geoip-update',
      'capture-status',
      'firewall-block-ip',
      'firewall-unblock-ip',
      'my-public-geo',
      'list-capture-adapters',
      'set-capture-adapter',
      'show-toast',
      'open-external-url',
      'window-minimize',
      'window-minimize-to-tray',
      'window-maximize-toggle',
      'window-is-maximized',
      'window-enter-float',
      'window-exit-float',
      'window-is-float',
      'window-close',
    ]);
    if (!allowed.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  onToast: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_evt, payload) => handler(payload);
    ipcRenderer.on('app-toast', listener);
    return () => ipcRenderer.removeListener('app-toast', listener);
  },
  onWindowState: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_evt, payload) => handler(payload);
    ipcRenderer.on('window-state', listener);
    return () => ipcRenderer.removeListener('window-state', listener);
  },
});
