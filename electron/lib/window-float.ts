import { screen, type BrowserWindow, type Rectangle } from 'electron';
import {
  FLOAT_HEIGHT,
  FLOAT_MIN_HEIGHT,
  FLOAT_MIN_WIDTH,
  FLOAT_WIDTH,
  NORMAL_MIN_HEIGHT,
  NORMAL_MIN_WIDTH,
} from './constants';

export type FloatModeDeps = {
  getMainWindow: () => BrowserWindow | null;
  getIsFloatMode: () => boolean;
  setIsFloatMode: (v: boolean) => void;
  getPreFloatBounds: () => Rectangle | null;
  setPreFloatBounds: (v: Rectangle | null) => void;
  emitWindowState: (win?: BrowserWindow | null) => void;
};

export function createFloatMode(deps: FloatModeDeps) {
  function enterFloatMode() {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { ok: false as const, error: 'Main window not active' };
    }
    if (deps.getIsFloatMode()) return { ok: true as const, float: true };

    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    if (mainWindow.isMinimized()) mainWindow.restore();

    deps.setPreFloatBounds(mainWindow.getBounds());
    deps.setIsFloatMode(true);

    mainWindow.setMinimumSize(FLOAT_MIN_WIDTH, FLOAT_MIN_HEIGHT);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setResizable(true);
    mainWindow.setSize(FLOAT_WIDTH, FLOAT_HEIGHT, true);

    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
    const x = Math.max(12, sw - FLOAT_WIDTH - 24);
    const y = Math.max(12, sh - FLOAT_HEIGHT - 24);
    mainWindow.setPosition(x, y, false);
    mainWindow.show();
    mainWindow.focus();
    deps.emitWindowState();
    return { ok: true as const, float: true };
  }

  function exitFloatMode() {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { ok: false as const, error: 'Main window not active' };
    }
    if (!deps.getIsFloatMode()) return { ok: true as const, float: false };

    deps.setIsFloatMode(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(NORMAL_MIN_WIDTH, NORMAL_MIN_HEIGHT);

    const pre = deps.getPreFloatBounds();
    if (pre) {
      mainWindow.setBounds(pre, false);
      deps.setPreFloatBounds(null);
    } else {
      mainWindow.setSize(1360, 900, false);
      mainWindow.center();
    }

    mainWindow.show();
    mainWindow.focus();
    deps.emitWindowState();
    return { ok: true as const, float: false };
  }

  return { enterFloatMode, exitFloatMode };
}
