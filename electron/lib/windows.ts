import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { NORMAL_MIN_HEIGHT, NORMAL_MIN_WIDTH } from './constants';
import type { createShowAppDialog } from './app-dialog';

export type WindowFactoryDeps = {
  electronRoot: string;
  appRoot: string;
  getSplashWindow: () => BrowserWindow | null;
  setSplashWindow: (win: BrowserWindow | null) => void;
  getMainWindow: () => BrowserWindow | null;
  setMainWindow: (win: BrowserWindow | null) => void;
  getIsQuitting: () => boolean;
  emitWindowState: (win?: BrowserWindow | null) => void;
  hardShutdown: (reason: string) => void;
  showAppDialog: ReturnType<typeof createShowAppDialog>;
};

export function createWindowFactory(deps: WindowFactoryDeps) {
  function createSplashWindow(iconPath?: string) {
    const splashWindow = new BrowserWindow({
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
    deps.setSplashWindow(splashWindow);

    const splashHtmlPath = path.join(deps.electronRoot, 'splash.html');
    if (fs.existsSync(splashHtmlPath)) {
      void splashWindow.loadFile(splashHtmlPath);
    }
  }

  function createMainWindow(iconPath?: string) {
    const preloadPath = path.join(deps.electronRoot, 'preload.cjs');

    const mainWindow = new BrowserWindow({
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
    deps.setMainWindow(mainWindow);

    mainWindow.webContents.on('preload-error', (_event, failedPath, error) => {
      console.error('[electron] preload-error:', failedPath, error);
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('file://')) event.preventDefault();
    });

    mainWindow.on('maximize', () => deps.emitWindowState(mainWindow));
    mainWindow.on('unmaximize', () => deps.emitWindowState(mainWindow));

    const distPath = path.join(deps.appRoot, 'dist', 'index.html');

    if (fs.existsSync(distPath)) {
      void mainWindow.loadFile(distPath);
    } else {
      void deps
        .showAppDialog({
          title: 'Build Missing',
          message: 'dist/index.html was not found.',
          detail: 'Rebuild with npm run build:exe before launching the portable app.',
          buttons: ['OK'],
          tone: 'danger',
          height: 240,
        })
        .then(() => app.quit());
      return;
    }

    setTimeout(() => {
      const splash = deps.getSplashWindow();
      if (splash && !splash.isDestroyed()) {
        splash.close();
        deps.setSplashWindow(null);
      }
      const main = deps.getMainWindow();
      if (main && !main.isDestroyed()) {
        main.show();
        main.focus();
      }
    }, 950);

    mainWindow.on('close', (event) => {
      if (deps.getIsQuitting()) return;
      event.preventDefault();
      deps.hardShutdown('main-window-close');
    });
  }

  return { createSplashWindow, createMainWindow };
}
