import { SettingsModal } from './SettingsModal';
import { TrustedManagerModal, type VerifiedNormalEntry } from './TrustedManagerModal';
import { BlacklistManagerModal } from './BlacklistManagerModal';
import type { PacketEngineActions } from '../services/packetEngineActions';
import type { BlacklistedIpItem, MonitoringConfig, TrustedEntry } from '../types/network';

type Props = {
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  isTrustedHubOpen: boolean;
  onCloseTrustedHub: () => void;
  isBlacklistOpen: boolean;
  onCloseBlacklist: () => void;
  config: MonitoringConfig;
  onSaveConfig: (next: MonitoringConfig) => void;
  onResetToDefaults: () => void | Promise<void>;
  trustedList: TrustedEntry[];
  verifiedNormalList: VerifiedNormalEntry[];
  blacklistedIps: BlacklistedIpItem[];
  actions: PacketEngineActions;
};

export function AppModals({
  isSettingsOpen,
  onCloseSettings,
  isTrustedHubOpen,
  onCloseTrustedHub,
  isBlacklistOpen,
  onCloseBlacklist,
  config,
  onSaveConfig,
  onResetToDefaults,
  trustedList,
  verifiedNormalList,
  blacklistedIps,
  actions,
}: Props) {
  return (
    <>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
        config={config}
        onSaveConfig={onSaveConfig}
        onResetToDefaults={async () => {
          await onResetToDefaults();
          await actions.resetAllMonitoringState();
        }}
      />

      <TrustedManagerModal
        isOpen={isTrustedHubOpen}
        onClose={onCloseTrustedHub}
        trustedList={trustedList}
        verifiedNormalList={verifiedNormalList}
        onRemoveTrusted={actions.removeTrustedIp}
        onAddTrusted={actions.addTrustedIp}
        onAddVerifiedNormal={actions.addVerifiedNormalIp}
        onPromoteToBaseline={actions.toggleBaseline}
        onResetNormalStatus={actions.resetNormalStatus}
        onResetTrustedList={actions.clearTrustedList}
        onResetVerifiedList={actions.clearVerifiedList}
      />

      <BlacklistManagerModal
        isOpen={isBlacklistOpen}
        onClose={onCloseBlacklist}
        blacklistedIps={blacklistedIps}
        onUnblockIp={actions.unblockIp}
        onAddBlockIp={actions.blockIp}
        onResetBlacklist={actions.clearBlacklist}
      />
    </>
  );
}
