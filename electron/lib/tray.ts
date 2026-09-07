import { Tray, Menu, nativeImage, type Tray as TrayType } from 'electron';
import fs from 'fs';

export type TrayControllerDeps = {
  getTray: () => TrayType | null;
  setTray: (t: TrayType | null) => void;
  showMainWindow: () => void;
  hardShutdown: (reason: string) => void;
};

export function createTrayController(deps: TrayControllerDeps) {
  function buildTrayMenu() {
    return Menu.buildFromTemplate([
      {
        label: 'Open NetSentinel',
        click: () => deps.showMainWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit NetSentinel',
        click: () => deps.hardShutdown('tray-quit'),
      },
    ]);
  }

  function createTray(iconPath?: string) {
    if (deps.getTray()) return;
    let image = null;
    if (iconPath && fs.existsSync(iconPath)) {
      image = nativeImage.createFromPath(iconPath);
      if (!image.isEmpty()) {
        const size = process.platform === 'win32' ? 16 : 22;
        image = image.resize({ width: size, height: size });
      }
    }
    if (!image || image.isEmpty()) {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKElEQVQ4T2NkYGD4z0ABYBzVMKoBBg0cNQAjwcgIJw+G0Q3AaMADAN6gBBH1nYcZAAAAAElFTkSuQmCC',
        'base64'
      );
      image = nativeImage.createFromBuffer(png);
    }

    const tray = new Tray(image);
    deps.setTray(tray);
    tray.setToolTip('NetSentinel — monitoring in background');
    tray.setContextMenu(buildTrayMenu());
    tray.on('double-click', () => deps.showMainWindow());
    tray.on('click', () => {
      if (process.platform === 'win32') deps.showMainWindow();
    });
  }

  return { createTray, buildTrayMenu };
}
