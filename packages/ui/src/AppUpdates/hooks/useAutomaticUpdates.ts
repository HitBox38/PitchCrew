import { useEffect } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { updatesKey, useDevicePreferences } from '@/lib/device-preferences.ts';

export function useAutomaticUpdates() {
  const enabled = useDevicePreferences((state) => state.automaticUpdates);
  const load = useWorkspaceStore((state) => state.loadAppUpdate);
  const check = useWorkspaceStore((state) => state.checkAppUpdate);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      await load();
      if (active && enabled && useWorkspaceStore.getState().appUpdate?.automatic)
        await check(false);
      // Schedule after completion so the daemon's hourly cache has expired at the next check.
      if (active)
        timer = setTimeout(() => {
          void refresh();
        }, 3_600_000);
    };
    void refresh();
    const synchronize = (event: StorageEvent) => {
      if (event.key !== updatesKey && event.key !== null) return;
      const next = event.key === null || event.newValue !== 'false';
      const preferences = useDevicePreferences.getState();
      if (preferences.automaticUpdates !== next) preferences.setAutomaticUpdates(next);
    };
    window.addEventListener('storage', synchronize);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('storage', synchronize);
    };
  }, [enabled, load, check]);
}
