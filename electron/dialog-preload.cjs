const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('netSentinelDialog', {
  sendResult: (index) => {
    ipcRenderer.send('app-dialog-result', Number(index));
  },
  openExternal: (url) => ipcRenderer.invoke('open-external-url', String(url || '')),
});
