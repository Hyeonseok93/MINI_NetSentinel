import { NPCAP_DOWNLOAD_URL } from './constants';
import { isRunningAsAdmin } from './elevation';
import type { createShowAppDialog } from './app-dialog';

export type AdminGateDeps = {
  getIsQuitting: () => boolean;
  showAppDialog: ReturnType<typeof createShowAppDialog>;
  relaunchAsAdmin: () => Promise<void>;
};

export type AdminGateResult = 'elevated' | 'continue-limited' | 'relaunching';

export function createAdminGate(deps: AdminGateDeps) {
  return async function ensureAdminOrPrompt(): Promise<AdminGateResult> {
    if (process.platform !== 'win32') return 'elevated';
    if (isRunningAsAdmin()) return 'elevated';

    while (!deps.getIsQuitting()) {
      const choice = await deps.showAppDialog({
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
          await deps.relaunchAsAdmin();
          return 'relaunching';
        } catch (err: unknown) {
          const cancelled = /cancelled/i.test(err instanceof Error ? err.message : '');
          await deps.showAppDialog({
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
  };
}
