import { useCallback, useEffect, useState } from 'react';
import { getElectronIpc, getElectronIpcOrWarn, invokeElectron } from '../utils/electronIpc';

export function useFloatMode() {
  const [isFloatMode, setIsFloatMode] = useState(false);

  useEffect(() => {
    const ipc = getElectronIpc();
    if (!ipc) return;
    ipc
      .invoke('window-is-float')
      .then((r: { float?: boolean }) => setIsFloatMode(!!r?.float))
      .catch(() => {});
    if (!ipc.onWindowState) return;
    return ipc.onWindowState((state) => {
      if (typeof state?.float === 'boolean') setIsFloatMode(state.float);
    });
  }, []);

  const enterFloatMode = useCallback(() => {
    if (!getElectronIpcOrWarn('Float mode')) return;
    invokeElectron('window-enter-float')
      .then((r: { float?: boolean }) => setIsFloatMode(!!r?.float))
      .catch(() => {});
  }, []);

  const exitFloatMode = useCallback(() => {
    if (!getElectronIpcOrWarn('Float mode')) return;
    invokeElectron('window-exit-float')
      .then((r: { float?: boolean }) => setIsFloatMode(!!r?.float))
      .catch(() => {});
  }, []);

  return { isFloatMode, enterFloatMode, exitFloatMode };
}
