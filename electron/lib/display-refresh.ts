import { app, powerMonitor, screen, type BrowserWindow } from 'electron';

export type DisplayRefreshDeps = {
  getMainWindow: () => BrowserWindow | null;
  getIsQuitting: () => boolean;
};

export function createDisplayRefresh(deps: DisplayRefreshDeps) {
  let displayRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  function refreshMainWindowSurface(reason = 'refresh', { nudge = true }: { nudge?: boolean } = {}) {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || deps.getIsQuitting()) return;
    try {
      if (!mainWindow.isVisible()) return;

      try {
        mainWindow.webContents.invalidate();
      } catch {
        /* ignore */
      }

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[electron] Display refresh failed:', message);
    }
  }

  function scheduleDisplayRefresh(reason: string, opts?: { nudge?: boolean }) {
    if (displayRefreshTimer) clearTimeout(displayRefreshTimer);
    displayRefreshTimer = setTimeout(() => {
      displayRefreshTimer = null;
      refreshMainWindowSurface(reason, opts);
    }, 450);
  }

  function wireDisplayResumeHandlers() {
    try {
      powerMonitor.on('resume', () => scheduleDisplayRefresh('power-resume'));
    } catch {
      /* ignore */
    }
    try {
      powerMonitor.on('unlock-screen', () => scheduleDisplayRefresh('unlock-screen'));
    } catch {
      /* ignore */
    }
    try {
      screen.on('display-metrics-changed', () => scheduleDisplayRefresh('display-metrics'));
    } catch {
      /* ignore */
    }

    app.on('browser-window-focus', (_evt, win) => {
      if (win === deps.getMainWindow()) scheduleDisplayRefresh('window-focus', { nudge: false });
    });

    app.on('child-process-gone', (_evt, details) => {
      const typ = String(details?.type || '').toLowerCase();
      if (typ === 'gpu' || typ === 'utility') {
        scheduleDisplayRefresh(`child-gone:${typ}`);
      }
    });
  }

  return { refreshMainWindowSurface, scheduleDisplayRefresh, wireDisplayResumeHandlers };
}
