import { useEffect } from 'react';
import { api } from '@/api.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { RuntimeMaintenanceState } from '@pitchcrew/core';

/** The shell schedules; the daemon deduplicates and enforces the shared daily interval. */
export const useRuntimeUpdateChecks = () => {
  const automatic = useWorkspaceStore(
    (state) => state.data?.runtimeMaintenance?.automatic ?? false,
  );
  const enabled = useWorkspaceStore((state) => state.data?.runtimeMaintenance?.enabled ?? false);
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup -- Cleanup clears the timer and prevents rescheduling after disposal.
  useEffect(() => {
    if (!automatic || !enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      let delay = 60_000;
      try {
        const result = await api<RuntimeMaintenanceState>('/runtimes/updates/check', 'POST', {
          automatic: true,
        });
        delay = Math.max(
          60_000,
          Date.parse(result.nextCheckAt ?? '') - Date.now() || 24 * 60 * 60_000,
        );
        await useWorkspaceStore.getState().reload();
      } catch {
        /* Offline automatic failures remain quiet and retry with backoff. */
      }
      if (active) timer = setTimeout(() => void check(), delay);
    };
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [automatic, enabled]);
};
