import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export function useManualUpdateCheck() {
  const check = useWorkspaceStore((state) => state.checkAppUpdate);
  return async () => {
    await check();
    const { appUpdate, desktopUpdate, appUpdateError, setToast } = useWorkspaceStore.getState();
    const message =
      appUpdateError || (desktopUpdate?.enabled ? desktopUpdate.message : appUpdate?.message);
    if (message)
      setToast(
        message,
        appUpdateError || appUpdate?.status === 'error' || desktopUpdate?.status === 'error'
          ? 'error'
          : 'info',
      );
  };
}
