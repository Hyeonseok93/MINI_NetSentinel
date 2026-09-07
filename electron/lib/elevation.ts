import { app, BrowserWindow } from 'electron';
import path from 'path';
import { execFileSync } from 'child_process';
import { createDialogWebPreferences } from './app-dialog';

export function isRunningAsAdmin(): boolean {
  if (process.platform !== 'win32') return true;
  try {
    execFileSync('net', ['session'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export type RelaunchAsAdminDeps = {
  getDialogWindow: () => BrowserWindow | null;
  setDialogWindow: (win: BrowserWindow | null) => void;
  dialogHtmlPath: string;
  dialogPreloadPath: string;
};

export function createRelaunchAsAdmin(deps: RelaunchAsAdminDeps) {
  return async function relaunchAsAdmin(): Promise<void> {
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
      webPreferences: createDialogWebPreferences(deps.dialogPreloadPath),
    });
    waitWin.setMenuBarVisibility(false);

    try {
      await waitWin.loadFile(deps.dialogHtmlPath, { search: qs.toString() });
      if (!waitWin.isDestroyed()) {
        waitWin.show();
        waitWin.focus();
      }
      await new Promise((r) => setTimeout(r, 80));

      try {
        app.releaseSingleInstanceLock();
      } catch {
        /* ignore */
      }

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
    } catch (err: unknown) {
      try {
        app.requestSingleInstanceLock();
      } catch {
        /* ignore */
      }
      const e = err as { stderr?: unknown; stdout?: unknown; message?: string };
      const stderr = e.stderr != null ? String(e.stderr) : '';
      const stdout = e.stdout != null ? String(e.stdout) : '';
      const combined = `${stderr}\n${stdout}\n${e.message || ''}`;
      if (/cancel|denied|1223|rejected/i.test(combined)) {
        throw new Error('Administrator elevation was cancelled.');
      }
      throw new Error('Could not restart as administrator.');
    } finally {
      try {
        if (!waitWin.isDestroyed()) waitWin.destroy();
      } catch {
        /* ignore */
      }
    }
  };
}
