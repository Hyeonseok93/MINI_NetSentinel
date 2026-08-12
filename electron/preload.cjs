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
      'window-minimize',
      'window-minimize-to-tray',
      'window-maximize-toggle',
      'window-is-maximized',
      'window-close',
    ]);
    if (!allowed.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
