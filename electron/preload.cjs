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
    ]);
    if (!allowed.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
