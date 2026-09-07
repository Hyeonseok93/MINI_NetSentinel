import { ipcMain, BrowserWindow, shell, app, type IpcMainInvokeEvent } from 'electron';
import path from 'path';
import type { FirewallApi, TelemetryApi } from './native-apis';

export type IpcHandlerDeps = {
  telemetry: TelemetryApi;
  firewall: FirewallApi;
  getMainWindow: () => BrowserWindow | null;
  getWritableGeoIpPath: () => string;
  getBundledGeoIpPaths: () => string[];
  hideMainWindowToTray: () => void;
  enterFloatMode: () => { ok: boolean; float?: boolean; error?: string };
  exitFloatMode: () => { ok: boolean; float?: boolean; error?: string };
  getIsFloatMode: () => boolean;
  allowedExternalUrls: Set<string>;
};

export function registerIpcHandlers(deps: IpcHandlerDeps) {
  const {
    telemetry,
    firewall,
    getMainWindow,
    getWritableGeoIpPath,
    getBundledGeoIpPaths,
    hideMainWindowToTray,
    enterFloatMode,
    exitFloatMode,
    getIsFloatMode,
    allowedExternalUrls,
  } = deps;

  function getSenderWindow(evt: IpcMainInvokeEvent) {
    return BrowserWindow.fromWebContents(evt.sender);
  }

  ipcMain.handle('get-live-netstat', async () => telemetry.fetchTelemetryPayload());

  ipcMain.handle('geoip-status', async () =>
    telemetry.ensureGeoIp({
      writablePath: getWritableGeoIpPath(),
      extraPaths: getBundledGeoIpPaths(),
      autoDownload: false,
    })
  );

  ipcMain.handle('geoip-update', async () => telemetry.updateGeoIp(getWritableGeoIpPath()));

  ipcMain.handle('capture-status', async () => telemetry.getCaptureStatus());

  ipcMain.handle('firewall-block-ip', async (_evt, ip, reason) =>
    firewall.firewallBlockIp(String(ip || ''), String(reason || 'NetSentinel block'))
  );

  ipcMain.handle('firewall-unblock-ip', async (_evt, ip) =>
    firewall.firewallUnblockIp(String(ip || ''))
  );

  ipcMain.handle('my-public-geo', async () =>
    telemetry.resolveMyPublicGeo({
      writablePath: getWritableGeoIpPath(),
      extraPaths: getBundledGeoIpPaths(),
      cachePath: path.join(app.getPath('userData'), 'my-public-ip.json'),
    })
  );

  ipcMain.handle('list-capture-adapters', async () => telemetry.listCaptureDevices());

  ipcMain.handle('set-capture-adapter', async (_evt, deviceName) => {
    const name = deviceName ? String(deviceName) : '';
    if (!name) return telemetry.setCaptureDevice(null);
    const listed = telemetry.listCaptureDevices() || [];
    const ok = listed.some((d) => d && d.name === name);
    if (!ok) {
      return { ok: false, error: `Unknown capture adapter: ${name}` };
    }
    return telemetry.setCaptureDevice(name);
  });

  ipcMain.handle('open-external-url', async (_evt, url) => {
    const target = String(url || '').trim();
    if (!allowedExternalUrls.has(target)) {
      return { ok: false, error: 'URL not allowed' };
    }
    await shell.openExternal(target);
    return { ok: true };
  });

  ipcMain.handle('window-minimize', (evt) => {
    const win = getSenderWindow(evt);
    if (win && !win.isDestroyed()) win.minimize();
    return { ok: true };
  });

  ipcMain.handle('window-minimize-to-tray', () => {
    hideMainWindowToTray();
    return { ok: true };
  });

  ipcMain.handle('window-maximize-toggle', (evt) => {
    const win = getSenderWindow(evt) || getMainWindow();
    if (!win || win.isDestroyed()) return { ok: false, maximized: false };
    if (getIsFloatMode()) {
      exitFloatMode();
      return { ok: true, maximized: win.isMaximized(), float: false };
    }
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    const maximized = win.isMaximized();
    try {
      win.webContents.send('window-state', { maximized, float: getIsFloatMode() });
    } catch {
      /* ignore */
    }
    return { ok: true, maximized };
  });

  ipcMain.handle('window-is-maximized', (evt) => {
    const win = getSenderWindow(evt) || getMainWindow();
    return { ok: true, maximized: !!(win && !win.isDestroyed() && win.isMaximized()) };
  });

  ipcMain.handle('window-enter-float', () => enterFloatMode());
  ipcMain.handle('window-exit-float', () => exitFloatMode());
  ipcMain.handle('window-is-float', () => ({ ok: true, float: getIsFloatMode() }));

  ipcMain.handle('window-close', (evt) => {
    const win = getSenderWindow(evt);
    if (win && !win.isDestroyed()) win.close();
    return { ok: true };
  });
}
