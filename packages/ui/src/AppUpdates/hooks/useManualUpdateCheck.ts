import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

export function useManualUpdateCheck() {
  const check = useWorkspaceStore((state) => state.checkAppUpdate);
  return async () => {
    await check();
    const { appUpdate, appUpdateError, setToast } = useWorkspaceStore.getState();
    const message = appUpdateError || appUpdate?.message;
    if (message)
      setToast(message, appUpdateError || appUpdate?.status === 'error' ? 'error' : 'info');
  };
}
