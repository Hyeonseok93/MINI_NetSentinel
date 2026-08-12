const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');
const telemetry = require('./scripts/telemetry-core.cjs');
const firewall = require('./scripts/firewall-windows.cjs');

// Display name (repo folder may use MINI_ prefix; product is NetSentinel)
try {
  app.setName('NetSentinel');
} catch (_) {}

let splashWindow = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let dialogWindow = null;

// One instance only — leftover processes were still toasting after "close"
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

function hardShutdown(reason = 'shutdown') {
  if (isQuitting) return;
  isQuitting = true;
  console.log('[electron] Hard shutdown:', reason);
  try {
    telemetry.stopPacketCapture();
  } catch (_) {}
  try {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  } catch (_) {}
  try {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
  } catch (_) {}
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  } catch (_) {}
  splashWindow = null;
  mainWindow = null;
  // Ensure all Electron child processes die (stops background toasts)
  app.exit(0);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Open NetSentinel',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit NetSentinel',
      click: () => hardShutdown('tray-quit'),
    },
  ]);
}

function createTray(iconPath) {
  if (tray) return;
  let image = null;
  if (iconPath && fs.existsSync(iconPath)) {
    image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      // Windows tray icons look best around 16–32px
      const size = process.platform === 'win32' ? 16 : 22;
      image = image.resize({ width: size, height: size });
    }
  }
  if (!image || image.isEmpty()) {
    // 16x16 cyan-ish fallback so tray still appears without icon.ico
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBzVMKoBBg0cNQAjwcgIJw+G0Q3AaMADAN6gBBH1nYcZAAAAAElFTkSuQmCC',
      'base64'
    );
    image = nativeImage.createFromBuffer(png);
  }

  tray = new Tray(image);
  tray.setToolTip('NetSentinel — monitoring in background');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => showMainWindow());
  // Windows: single left-click also opens the app (context menu is right-click)
  tray.on('click', (_event, _bounds, position) => {
    if (process.platform === 'win32') showMainWindow();
  });
}

function isRunningAsAdmin() {
  if (process.platform !== 'win32') return true;
  try {
    // Succeeds only when elevated
    execFileSync('net', ['session'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function relaunchAsAdmin() {
  const exePath = process.execPath;
  const psExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const escaped = exePath.replace(/'/g, "''");
  const command = `Start-Process -FilePath '${escaped}' -Verb RunAs`;

  spawn(psExe, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

/**
 * Dark NetSentinel-styled modal (replaces dialog.showMessageBox / showErrorBox).
 * @returns {Promise<number>} clicked button index
 */
function showAppDialog(options = {}) {
  const {
    title = 'NetSentinel',
    message = '',
    detail = '',
    buttons = ['OK'],
    tone = 'default',
    width = 460,
    height = 320,
  } = options;

  return new Promise((resolve) => {
    if (dialogWindow && !dialogWindow.isDestroyed()) {
      try { dialogWindow.close(); } catch (_) {}
      dialogWindow = null;
    }

    const htmlPath = path.join(__dirname, 'electron', 'app-dialog.html');
    const qs = new URLSearchParams({
      title: String(title),
      message: String(message),
      detail: String(detail || ''),
      tone: String(tone),
      buttons: JSON.stringify(buttons),
    });

    let settled = false;
    const finish = (index) => {
      if (settled) return;
      settled = true;
      const idx = Number.isFinite(Number(index))
        ? Number(index)
        : buttons.length > 1
          ? buttons.length - 1
          : 0;
      try {
        ipcMain.removeListener('app-dialog-result', onResult);
      } catch (_) {}
      if (dialogWindow && !dialogWindow.isDestroyed()) {
        try { dialogWindow.close(); } catch (_) {}
      }
      dialogWindow = null;
      resolve(idx);
    };

    const onResult = (_evt, index) => finish(index);

    dialogWindow = new BrowserWindow({
      width,
      height,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      frame: false,
      show: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      modal: Boolean(mainWindow && !mainWindow.isDestroyed()),
      backgroundColor: '#020617',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
      },
    });

    const win = dialogWindow;
    ipcMain.once('app-dialog-result', onResult);
    win.on('closed', () => {
      if (!settled) finish(buttons.length > 1 ? buttons.length - 1 : 0);
    });
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) win.show();
    });
    win.loadFile(htmlPath, { search: qs.toString() });
  });
}

/**
 * @returns {Promise<'elevated' | 'continue-limited' | 'relaunching'>}
 */
async function ensureAdminOrPrompt() {
  if (process.platform !== 'win32') return 'elevated';
  if (isRunningAsAdmin()) return 'elevated';

  const choice = await showAppDialog({
    title: 'Administrator required',
    message: 'NetSentinel needs administrator privileges for full capture and firewall control.',
    detail:
      'Required for:\n' +
      '• Npcap live packet / byte capture\n' +
      '• Blacklist → Windows Firewall block/unblock\n\n' +
      'Restart as admin to enable these features.\n' +
      'Limited mode keeps Netstat inventory only (firewall rules may not apply).',
    buttons: ['Restart as Admin', 'Continue Limited'],
    tone: 'warning',
    width: 480,
    height: 400,
  });

  if (choice === 0) {
    try {
      relaunchAsAdmin();
    } catch (err) {
      await showAppDialog({
        title: 'Elevation failed',
        message: (err && err.message) || String(err),
        buttons: ['OK'],
        tone: 'danger',
        height: 220,
      });
      return 'continue-limited';
    }
    return 'relaunching';
  }

  return 'continue-limited';
}

function getWritableGeoIpPath() {
  return path.join(app.getPath('userData'), telemetry.GEOIP_DB_FILENAME);
}

function getBundledGeoIpPaths() {
  const resourcesPath = process.resourcesPath || '';
  return [
    path.join(__dirname, 'data', telemetry.GEOIP_DB_FILENAME),
    path.join(resourcesPath, 'app.asar.unpacked', 'data', telemetry.GEOIP_DB_FILENAME),
    path.join(resourcesPath, 'app', 'data', telemetry.GEOIP_DB_FILENAME),
  ];
}

ipcMain.handle('get-live-netstat', async () => {
  return telemetry.fetchTelemetryPayload();
});

ipcMain.handle('geoip-status', async () => {
  const status = await telemetry.ensureGeoIp({
    writablePath: getWritableGeoIpPath(),
    extraPaths: getBundledGeoIpPaths(),
    autoDownload: false,
  });
  return status;
});

ipcMain.handle('geoip-update', async () => {
  return telemetry.updateGeoIp(getWritableGeoIpPath());
});

ipcMain.handle('capture-status', async () => {
  return telemetry.getCaptureStatus();
});

ipcMain.handle('firewall-block-ip', async (_evt, ip, reason) => {
  return firewall.firewallBlockIp(String(ip || ''), String(reason || 'NetSentinel block'));
});

ipcMain.handle('firewall-unblock-ip', async (_evt, ip) => {
  return firewall.firewallUnblockIp(String(ip || ''));
});

ipcMain.handle('my-public-geo', async () => {
  return telemetry.resolveMyPublicGeo({
    writablePath: getWritableGeoIpPath(),
    extraPaths: getBundledGeoIpPaths(),
    cachePath: path.join(app.getPath('userData'), 'my-public-ip.json'),
  });
});

ipcMain.handle('list-capture-adapters', async () => {
  return telemetry.listCaptureDevices();
});

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

ipcMain.handle('show-toast', async (_evt, payload) => {
  // OS Notification removed — forward to renderer in-app toast host.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-toast', {
      title: String(payload?.title || 'NetSentinel').slice(0, 120),
      body: String(payload?.body || '').slice(0, 400),
    });
  }
  return { ok: true, mode: 'in-app' };
});

function getSenderWindow(evt) {
  return BrowserWindow.fromWebContents(evt.sender);
}

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
  const win = getSenderWindow(evt);
  if (!win || win.isDestroyed()) return { ok: false, maximized: false };
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return { ok: true, maximized: win.isMaximized() };
});

ipcMain.handle('window-is-maximized', (evt) => {
  const win = getSenderWindow(evt);
  return { ok: true, maximized: !!(win && !win.isDestroyed() && win.isMaximized()) };
});

ipcMain.handle('window-close', (evt) => {
  const win = getSenderWindow(evt);
  if (win && !win.isDestroyed()) win.close();
  return { ok: true };
});

function createSplashWindow(iconPath) {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    icon: iconPath,
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const splashHtmlPath = path.join(__dirname, 'electron', 'splash.html');
  if (fs.existsSync(splashHtmlPath)) {
    splashWindow.loadFile(splashHtmlPath);
  }
}

function createMainWindow(iconPath) {
  const preloadPath = path.join(__dirname, 'electron', 'preload.cjs');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    title: 'NetSentinel',
    icon: iconPath,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#020617',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  const distPath1 = path.join(__dirname, 'dist', 'index.html');
  const distPath2 = path.join(process.resourcesPath || '', 'app', 'dist', 'index.html');

  if (fs.existsSync(distPath1)) {
    mainWindow.loadFile(distPath1);
  } else if (fs.existsSync(distPath2)) {
    mainWindow.loadFile(distPath2);
  } else {
    void showAppDialog({
      title: 'Build Missing',
      message: 'dist/index.html was not found.',
      detail: 'Rebuild with npm run build:exe before launching the portable app.',
      buttons: ['OK'],
      tone: 'danger',
      height: 240,
    }).then(() => app.quit());
    return;
  }

  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 950);

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hardShutdown('main-window-close');
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  const adminState = await ensureAdminOrPrompt();
  if (adminState === 'relaunching') {
    hardShutdown('relaunching-elevated');
    return;
  }

  const iconPath1 = path.join(__dirname, 'public', 'icon.ico');
  const iconPath2 = path.join(process.resourcesPath || '', 'app', 'public', 'icon.ico');
  const iconPath = fs.existsSync(iconPath1) ? iconPath1 : fs.existsSync(iconPath2) ? iconPath2 : undefined;

  if (adminState === 'continue-limited') {
    console.warn('[electron] Running without administrator privileges (limited mode)');
  } else {
    console.log('[electron] Running elevated (administrator)');
  }

  // Prefer Npcap packet capture; fall back to netstat connection inventory
  const capture = telemetry.startPacketCapture();
  if (capture.ok) {
    console.log('[electron] Capture mode: Npcap', capture.device || '');
  } else {
    console.warn('[electron] Capture mode: Netstat —', capture.error || 'Npcap unavailable');
  }

  await telemetry.ensureGeoIp({
    writablePath: getWritableGeoIpPath(),
    extraPaths: getBundledGeoIpPaths(),
    autoDownload: true,
  });

  createSplashWindow(iconPath);
  createMainWindow(iconPath);
  createTray(iconPath);

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow(iconPath);
    } else {
      showMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Hidden-to-tray keeps the BrowserWindow alive — only quit when truly closing
  if (isQuitting) return;
  if (process.platform !== 'darwin') {
    hardShutdown('window-all-closed');
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  try {
    telemetry.stopPacketCapture();
  } catch (_) {}
});

app.on('will-quit', () => {
  isQuitting = true;
  try {
    telemetry.stopPacketCapture();
  } catch (_) {}
});
