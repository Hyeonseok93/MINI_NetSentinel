const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, powerMonitor, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const telemetry = require('./scripts/telemetry-core.cjs');
const firewall = require('./scripts/firewall-windows.cjs');

// Display name (repo folder may use MINI_ prefix; product is NetSentinel)
try {
  app.setName('NetSentinel');
} catch (_) {}

/** Official Npcap download — do not bundle redistributed installers in-repo. */
const NPCAP_DOWNLOAD_URL = 'https://npcap.com/#download';
let splashWindow = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let dialogWindow = null;
let isFloatMode = false;
/** @type {{ x: number, y: number, width: number, height: number } | null} */
let preFloatBounds = null;
let displayRefreshTimer = null;

const NORMAL_MIN_WIDTH = 1200;
const NORMAL_MIN_HEIGHT = 760;
const FLOAT_WIDTH = 410;
const FLOAT_HEIGHT = 370;
const FLOAT_MIN_WIDTH = 410;
const FLOAT_MIN_HEIGHT = 370;

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
  scheduleDisplayRefresh('show-main');
}

/**
 * After screensaver / sleep / GPU hiccup Windows often leaves a blank
 * BrowserWindow (only backgroundColor). Force a compositor redraw.
 */
function refreshMainWindowSurface(reason = 'refresh', { nudge = true } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || isQuitting) return;
  try {
    if (!mainWindow.isVisible()) return;

    try {
      mainWindow.webContents.invalidate();
    } catch (_) {}

    // 1px bounds nudge wakes DWM/GPU paint after display power cycle
    if (
      nudge &&
      process.platform === 'win32' &&
      !mainWindow.isMaximized() &&
      !mainWindow.isFullScreen()
    ) {
      const b = mainWindow.getBounds();
      mainWindow.setBounds({ ...b, width: Math.max(1, b.width + 1) });
      mainWindow.setBounds(b);
    }

    console.log('[electron] Display surface refresh:', reason);
  } catch (err) {
    console.warn('[electron] Display refresh failed:', err?.message || err);
  }
}

function scheduleDisplayRefresh(reason, opts) {
  if (displayRefreshTimer) clearTimeout(displayRefreshTimer);
  // Wait for GPU/driver to come back after resume/unlock
  displayRefreshTimer = setTimeout(() => {
    displayRefreshTimer = null;
    refreshMainWindowSurface(reason, opts);
  }, 450);
}

function wireDisplayResumeHandlers() {
  try {
    powerMonitor.on('resume', () => scheduleDisplayRefresh('power-resume'));
  } catch (_) {}
  try {
    powerMonitor.on('unlock-screen', () => scheduleDisplayRefresh('unlock-screen'));
  } catch (_) {}
  try {
    screen.on('display-metrics-changed', () => scheduleDisplayRefresh('display-metrics'));
  } catch (_) {}

  // Soft invalidate only — avoid layout nudge on every focus
  app.on('browser-window-focus', (_evt, win) => {
    if (win === mainWindow) scheduleDisplayRefresh('window-focus', { nudge: false });
  });

  app.on('child-process-gone', (_evt, details) => {
    const typ = String(details?.type || '').toLowerCase();
    if (typ === 'gpu' || typ === 'utility') {
      scheduleDisplayRefresh(`child-gone:${typ}`);
    }
  });
}

function emitWindowState(win = mainWindow) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('window-state', {
      maximized: win.isMaximized(),
      float: isFloatMode,
    });
  } catch (_) {}
}

function enterFloatMode() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: 'Main window not active' };
  }
  if (isFloatMode) return { ok: true, float: true };

  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  if (mainWindow.isMinimized()) mainWindow.restore();

  preFloatBounds = mainWindow.getBounds();
  isFloatMode = true;

  mainWindow.setMinimumSize(FLOAT_MIN_WIDTH, FLOAT_MIN_HEIGHT);
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setResizable(true);
  mainWindow.setSize(FLOAT_WIDTH, FLOAT_HEIGHT, true);

  const { width: sw, height: sh } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  const x = Math.max(12, sw - FLOAT_WIDTH - 24);
  const y = Math.max(12, sh - FLOAT_HEIGHT - 24);
  mainWindow.setPosition(x, y, false);
  mainWindow.show();
  mainWindow.focus();
  emitWindowState();
  return { ok: true, float: true };
}

function exitFloatMode() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { ok: false, error: 'Main window not active' };
  }
  if (!isFloatMode) return { ok: true, float: false };

  isFloatMode = false;
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setMinimumSize(NORMAL_MIN_WIDTH, NORMAL_MIN_HEIGHT);

  if (preFloatBounds) {
    mainWindow.setBounds(preFloatBounds, false);
    preFloatBounds = null;
  } else {
    mainWindow.setSize(1360, 900, false);
    mainWindow.center();
  }

  mainWindow.show();
  mainWindow.focus();
  emitWindowState();
  return { ok: true, float: false };
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

/**
 * Show a NetSentinel-styled wait dialog, then trigger UAC elevation.
 * (Previously a blank black BrowserWindow appeared before HTML painted.)
 */
async function relaunchAsAdmin() {
  if (process.platform !== 'win32') {
    throw new Error('Elevation is only supported on Windows');
  }

  const exePath = process.execPath;
  const workDir = path.dirname(exePath);
  const escapedExe = exePath.replace(/'/g, "''");
  const escapedCwd = workDir.replace(/'/g, "''");

  let argClause = '';
  if (!app.isPackaged) {
    const args = process.argv.slice(1).map((a) => `'${String(a).replace(/'/g, "''")}'`);
    if (args.length) argClause = ` -ArgumentList @(${args.join(',')})`;
  }

  const command = [
    "[Threading.Thread]::CurrentThread.CurrentUICulture = 'en-US';",
    "$ErrorActionPreference = 'Stop';",
    `Start-Process -FilePath '${escapedExe}' -WorkingDirectory '${escapedCwd}'${argClause} -Verb RunAs`,
  ].join(' ');

  const psExe = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );

  if (dialogWindow && !dialogWindow.isDestroyed()) {
    try { dialogWindow.close(); } catch (_) {}
    dialogWindow = null;
  }

  const htmlPath = path.join(__dirname, 'electron', 'app-dialog.html');
  const qs = new URLSearchParams({
    title: 'Restarting as administrator',
    message: 'Waiting for the Windows security (UAC) prompt…',
    detail:
      'This window stays open while Windows asks for permission.\n' +
      'Choose Yes to relaunch NetSentinel with administrator rights.',
    tone: 'warning',
    buttons: JSON.stringify([]),
  });

  const waitWin = new BrowserWindow({
    width: 460,
    height: 240,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });
  waitWin.setMenuBarVisibility(false);

  try {
    await waitWin.loadFile(htmlPath, { search: qs.toString() });
    if (!waitWin.isDestroyed()) {
      waitWin.show();
      waitWin.focus();
    }
    // Let Chromium paint the dialog before we block on UAC
    await new Promise((r) => setTimeout(r, 80));

    try {
      app.releaseSingleInstanceLock();
    } catch (_) {}

    execFileSync(
      psExe,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', command],
      {
        cwd: workDir,
        timeout: 180000,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  } catch (err) {
    try {
      app.requestSingleInstanceLock();
    } catch (_) {}
    const stderr = err && err.stderr != null ? String(err.stderr) : '';
    const stdout = err && err.stdout != null ? String(err.stdout) : '';
    const combined = `${stderr}\n${stdout}\n${(err && err.message) || ''}`;
    if (/cancel|denied|1223|rejected/i.test(combined)) {
      throw new Error('Administrator elevation was cancelled.');
    }
    throw new Error('Could not restart as administrator.');
  } finally {
    try {
      if (waitWin && !waitWin.isDestroyed()) waitWin.destroy();
    } catch (_) {}
  }
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
    linkUrl = '',
    linkLabel = '',
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
      linkUrl: String(linkUrl || ''),
      linkLabel: String(linkLabel || linkUrl || ''),
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

  while (!isQuitting) {
    const choice = await showAppDialog({
      title: 'Administrator required',
      message: 'NetSentinel needs administrator privileges for full capture and firewall control.',
      linkUrl: NPCAP_DOWNLOAD_URL,
      linkLabel: NPCAP_DOWNLOAD_URL,
      detail:
        'Required for:\n' +
        '• Npcap live packet / byte capture\n' +
        '• Blacklist → Windows Firewall block/unblock\n\n' +
        'Restart as admin to enable these features.\n' +
        'Limited mode keeps Netstat inventory only (firewall rules may not apply).',
      buttons: ['Restart as Admin', 'Continue Limited'],
      tone: 'warning',
      width: 500,
      height: 360,
    });

    if (choice === 0) {
      try {
        await relaunchAsAdmin();
        return 'relaunching';
      } catch (err) {
        const cancelled = /cancelled/i.test((err && err.message) || '');
        await showAppDialog({
          title: 'Elevation failed',
          message: cancelled
            ? 'Administrator elevation was cancelled.'
            : 'Could not restart as administrator.',
          detail:
            'Right-click NetSentinel.exe → Run as administrator.\n\n' +
            'You can try again, or continue in limited mode.',
          linkUrl: NPCAP_DOWNLOAD_URL,
          linkLabel: NPCAP_DOWNLOAD_URL,
          buttons: ['OK'],
          tone: 'danger',
          width: 460,
          height: 260,
        });
        continue;
      }
    }

    return 'continue-limited';
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

const ALLOWED_EXTERNAL_URLS = new Set([NPCAP_DOWNLOAD_URL, 'https://npcap.com/']);

ipcMain.handle('open-external-url', async (_evt, url) => {
  const target = String(url || '').trim();
  if (!ALLOWED_EXTERNAL_URLS.has(target)) {
    return { ok: false, error: 'URL not allowed' };
  }
  await shell.openExternal(target);
  return { ok: true };
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
  if (isFloatMode) {
    // Maximize not meaningful in float HUD — expand to full UI first
    exitFloatMode();
    return { ok: true, maximized: win.isMaximized(), float: false };
  }
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  const maximized = win.isMaximized();
  emitWindowState(win);
  return { ok: true, maximized };
});

ipcMain.handle('window-is-maximized', (evt) => {
  const win = getSenderWindow(evt);
  return { ok: true, maximized: !!(win && !win.isDestroyed() && win.isMaximized()) };
});

ipcMain.handle('window-enter-float', () => enterFloatMode());
ipcMain.handle('window-exit-float', () => exitFloatMode());
ipcMain.handle('window-is-float', () => ({ ok: true, float: isFloatMode }));

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
    minWidth: NORMAL_MIN_WIDTH,
    minHeight: NORMAL_MIN_HEIGHT,
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

  mainWindow.on('maximize', () => emitWindowState(mainWindow));
  mainWindow.on('unmaximize', () => emitWindowState(mainWindow));

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

  wireDisplayResumeHandlers();

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
