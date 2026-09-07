import type { BrowserWindow, WebPreferences } from 'electron';
import { BrowserWindow as BW, ipcMain } from 'electron';

export function createDialogWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  };
}

export type AppDialogOptions = {
  title?: string;
  message?: string;
  detail?: string;
  linkUrl?: string;
  linkLabel?: string;
  buttons?: string[];
  tone?: string;
  width?: number;
  height?: number;
};

export type ShowAppDialogDeps = {
  getDialogWindow: () => BrowserWindow | null;
  setDialogWindow: (win: BrowserWindow | null) => void;
  getMainWindow: () => BrowserWindow | null;
  dialogPreloadPath: string;
  htmlPath: string;
};

/**
 * Electron main-process dialog helper.
 * Renderer in-app confirms use src/ui/confirmBus.ts instead.
 */
export function createShowAppDialog(deps: ShowAppDialogDeps) {
  return function showAppDialog(options: AppDialogOptions = {}): Promise<number> {
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
      let dialogWindow = deps.getDialogWindow();
      if (dialogWindow && !dialogWindow.isDestroyed()) {
        try {
          dialogWindow.close();
        } catch {
          /* ignore */
        }
        deps.setDialogWindow(null);
      }

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
      const finish = (index: unknown) => {
        if (settled) return;
        settled = true;
        const idx = Number.isFinite(Number(index))
          ? Number(index)
          : buttons.length > 1
            ? buttons.length - 1
            : 0;
        try {
          ipcMain.removeListener('app-dialog-result', onResult);
        } catch {
          /* ignore */
        }
        dialogWindow = deps.getDialogWindow();
        if (dialogWindow && !dialogWindow.isDestroyed()) {
          try {
            dialogWindow.close();
          } catch {
            /* ignore */
          }
        }
        deps.setDialogWindow(null);
        resolve(idx);
      };

      const onResult = (_evt: Electron.IpcMainEvent, index: unknown) => finish(index);
      const mainWindow = deps.getMainWindow();

      dialogWindow = new BW({
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
        webPreferences: createDialogWebPreferences(deps.dialogPreloadPath),
      });
      deps.setDialogWindow(dialogWindow);

      ipcMain.once('app-dialog-result', onResult);
      dialogWindow.on('closed', () => {
        if (!settled) finish(buttons.length > 1 ? buttons.length - 1 : 0);
      });
      dialogWindow.once('ready-to-show', () => {
        if (dialogWindow && !dialogWindow.isDestroyed()) dialogWindow.show();
      });
      void dialogWindow.loadFile(deps.htmlPath, { search: qs.toString() });
    });
  };
}
