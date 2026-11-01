import { useState } from 'react';
import type { DetectorProvider } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/** Save or remove the user's own detector keys; the daemon never returns a saved key. */
export const useDetectorSettings = () => {
  const statuses = useWorkspaceStore((s) => s.data?.quality?.detectors ?? []);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const [editing, setEditing] = useState<DetectorProvider | null>(null);
  const save = async (provider: DetectorProvider, key: string, email: string) => {
    await action(
      `/detectors/${provider}/key`,
      'PUT',
      { key, ...(email ? { email } : {}) },
      'Detector key saved on this device',
    );
    setEditing(null);
  };
  const remove = (provider: DetectorProvider) =>
    action(`/detectors/${provider}/key`, 'DELETE', undefined, 'Detector key removed').catch(
      () => {},
    );
  return { statuses, working, editing, setEditing, save, remove };
};
