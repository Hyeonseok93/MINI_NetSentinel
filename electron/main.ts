import { app, BrowserWindow, type Rectangle } from 'electron';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createShowAppDialog } from './lib/app-dialog';
import { createRelaunchAsAdmin } from './lib/elevation';
import { createDisplayRefresh } from './lib/display-refresh';
import { createFloatMode } from './lib/window-float';
import { createTrayController } from './lib/tray';
import { registerIpcHandlers } from './lib/ipc-handlers';
import { createWindowFactory } from './lib/windows';
import { createAdminGate } from './lib/admin-gate';
import { ALLOWED_EXTERNAL_URLS } from './lib/constants';
import type { FirewallApi, TelemetryApi } from './lib/native-apis';

/** electron/dist → electron/ ; electron/main.js if emitted flat would differ — keep dist layout. */
const ELECTRON_ROOT = path.join(__dirname, '..');
const APP_ROOT = path.join(ELECTRON_ROOT, '..');

const nodeRequire = createRequire(__filename);
const telemetry = nodeRequire(path.join(APP_ROOT, 'scripts', 'telemetry-core.cjs')) as TelemetryApi;
const firewall = nodeRequire(path.join(APP_ROOT, 'scripts', 'firewall-windows.cjs')) as FirewallApi;

try {
  app.setName('NetSentinel');
} catch {
  /* ignore */
}

const DIALOG_PRELOAD = path.join(ELECTRON_ROOT, 'dialog-preload.cjs');
const DIALOG_HTML = path.join(ELECTRON_ROOT, 'app-dialog.html');

let splashWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Electron.Tray | null = null;
let isQuitting = false;
let dialogWindow: BrowserWindow | null = null;
let isFloatMode = false;
let preFloatBounds: Rectangle | null = null;

const showAppDialog = createShowAppDialog({
  getDialogWindow: () => dialogWindow,
  setDialogWindow: (win) => {
    dialogWindow = win;
  },
  getMainWindow: () => mainWindow,
  dialogPreloadPath: DIALOG_PRELOAD,
  htmlPath: DIALOG_HTML,
});

const relaunchAsAdmin = createRelaunchAsAdmin({
  getDialogWindow: () => dialogWindow,
  setDialogWindow: (win) => {
    dialogWindow = win;
  },
  dialogHtmlPath: DIALOG_HTML,
  dialogPreloadPath: DIALOG_PRELOAD,
});

const { scheduleDisplayRefresh, wireDisplayResumeHandlers } = createDisplayRefresh({
  getMainWindow: () => mainWindow,
  getIsQuitting: () => isQuitting,
});

function emitWindowState(win: BrowserWindow | null = mainWindow) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('window-state', {
      maximized: win.isMaximized(),
      float: isFloatMode,
    });
  } catch {
    /* ignore */
  }
}

const { enterFloatMode, exitFloatMode } = createFloatMode({
  getMainWindow: () => mainWindow,
  getIsFloatMode: () => isFloatMode,
  setIsFloatMode: (v) => {
    isFloatMode = v;
  },
  getPreFloatBounds: () => preFloatBounds,
  setPreFloatBounds: (v) => {
    preFloatBounds = v;
  },
  emitWindowState,
});

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
  } catch {
    /* ignore */
  }
  try {
    if (tray) {
      tray.destroy();
      tray = null;
    }
  } catch {
    /* ignore */
  }
  try {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
  } catch {
    /* ignore */
  }
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  } catch {
    /* ignore */
  }
  splashWindow = null;
  mainWindow = null;
  app.exit(0);
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  scheduleDisplayRefresh('show-main');
}

function hideMainWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.hide();
}

const { createTray } = createTrayController({
  getTray: () => tray,
  setTray: (t) => {
    tray = t;
  },
  showMainWindow,
  hardShutdown,
});

const ensureAdminOrPrompt = createAdminGate({
  getIsQuitting: () => isQuitting,
  showAppDialog,
  relaunchAsAdmin,
});

function getWritableGeoIpPath() {
  return path.join(app.getPath('userData'), telemetry.GEOIP_DB_FILENAME);
}

function getBundledGeoIpPaths() {
  const resourcesPath = process.resourcesPath || '';
  return [
    path.join(APP_ROOT, 'data', telemetry.GEOIP_DB_FILENAME),
    path.join(resourcesPath, 'app.asar.unpacked', 'data', telemetry.GEOIP_DB_FILENAME),
  ];
}

registerIpcHandlers({
  telemetry,
  firewall,
  getMainWindow: () => mainWindow,
  getWritableGeoIpPath,
  getBundledGeoIpPaths,
  hideMainWindowToTray,
  enterFloatMode,
  exitFloatMode,
  getIsFloatMode: () => isFloatMode,
  allowedExternalUrls: ALLOWED_EXTERNAL_URLS,
});

const { createSplashWindow, createMainWindow } = createWindowFactory({
  electronRoot: ELECTRON_ROOT,
  appRoot: APP_ROOT,
  getSplashWindow: () => splashWindow,
  setSplashWindow: (win) => {
    splashWindow = win;
  },
  getMainWindow: () => mainWindow,
  setMainWindow: (win) => {
    mainWindow = win;
  },
  getIsQuitting: () => isQuitting,
  emitWindowState,
  hardShutdown,
  showAppDialog,
});

void app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;

  wireDisplayResumeHandlers();

  const adminState = await ensureAdminOrPrompt();
  if (adminState === 'relaunching') {
    hardShutdown('relaunching-elevated');
    return;
  }

  const iconPath1 = path.join(APP_ROOT, 'public', 'icon.ico');
  const iconPath = fs.existsSync(iconPath1) ? iconPath1 : undefined;

  if (adminState === 'continue-limited') {
    console.warn('[electron] Running without administrator privileges (limited mode)');
  } else {
    console.log('[electron] Running elevated (administrator)');
  }

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
  if (isQuitting) return;
  if (process.platform !== 'darwin') {
    hardShutdown('window-all-closed');
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  try {
    telemetry.stopPacketCapture();
  } catch {
    /* ignore */
  }
});

app.on('will-quit', () => {
  isQuitting = true;
  try {
    telemetry.stopPacketCapture();
  } catch {
    /* ignore */
  }
});
