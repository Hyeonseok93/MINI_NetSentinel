const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFileSync, spawn } = require('child_process');
const telemetry = require('./scripts/telemetry-core.cjs');
const firewall = require('./scripts/firewall-windows.cjs');

let splashWindow = null;
let mainWindow = null;

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
 * @returns {'elevated' | 'continue-limited' | 'relaunching'}
 */
function ensureAdminOrPrompt() {
  if (process.platform !== 'win32') return 'elevated';
  if (isRunningAsAdmin()) return 'elevated';

  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    buttons: ['관리자 권한으로 다시 시작', '제한 모드로 계속'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: '관리자 권한 필요',
    message: 'NetSentinel은 관리자 권한으로 실행해야 합니다.',
    detail:
      '아래 기능을 정상적으로 쓰려면 관리자 권한이 필요합니다.\n\n' +
      '• Npcap 실시간 패킷/바이트 캡쳐\n' +
      '• 블랙리스트 → Windows 방화벽 차단/해제\n\n' +
      '「관리자 권한으로 다시 시작」을 누르면 UAC 확인 창이 뜹니다.\n\n' +
      '제한 모드로 계속하면 Netstat 연결 목록만 사용됩니다.\n' +
      '이 경우 방화벽 규칙은 적용되지 않을 수 있습니다.',
  });

  if (choice === 0) {
    try {
      relaunchAsAdmin();
    } catch (err) {
      dialog.showErrorBox(
        '관리자 권한 재실행 실패',
        (err && err.message) || String(err)
      );
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
  return telemetry.setCaptureDevice(deviceName ? String(deviceName) : null);
});

ipcMain.handle('show-toast', async (_evt, payload) => {
  try {
    const { Notification } = require('electron');
    if (!Notification.isSupported()) {
      return { ok: false, error: 'Notifications not supported' };
    }
    const note = new Notification({
      title: String(payload?.title || 'NetSentinel'),
      body: String(payload?.body || ''),
      silent: false,
    });
    note.show();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
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
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'NetSentinel Enterprise',
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#020617',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
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
    dialog.showErrorBox(
      'Build Missing',
      'dist/index.html was not found. Rebuild with npm run build:exe before launching the portable app.'
    );
    app.quit();
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
}

app.whenReady().then(async () => {
  const adminState = ensureAdminOrPrompt();
  if (adminState === 'relaunching') {
    app.quit();
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(iconPath);
    }
  });
});

app.on('window-all-closed', () => {
  telemetry.stopPacketCapture();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
