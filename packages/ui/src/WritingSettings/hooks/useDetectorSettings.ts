import { useEffect, useRef, useState } from 'react';
import type { DetectorProvider } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/** Save or remove the user's own detector keys; the daemon never returns a saved key. */
export const useDetectorSettings = () => {
  const statuses = useWorkspaceStore((s) => s.data?.quality?.detectors ?? []);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const [editing, setEditing] = useState<DetectorProvider | null>(null);
  const [returnFocus, setReturnFocus] = useState<{ provider: DetectorProvider } | null>(null);
  const restored = useRef<typeof returnFocus>(null);
  const close = (provider: DetectorProvider | null) => {
    setReturnFocus(provider ? { provider } : null);
    setEditing(null);
  };
  useEffect(() => {
    if (working || !returnFocus || restored.current === returnFocus) return;
    const trigger = document.getElementById(`detector-${returnFocus.provider}-key-trigger`);
    if (!(trigger instanceof HTMLButtonElement) || trigger.disabled) return;
    restored.current = returnFocus;
    trigger.focus();
  }, [working, returnFocus]);
  const save = async (provider: DetectorProvider, key: string, email: string) => {
    await action(
      `/detectors/${provider}/key`,
      'PUT',
      { key, ...(email ? { email } : {}) },
      'Detector key saved in this workspace',
    );
    close(provider);
  };
  const remove = (provider: DetectorProvider) =>
    action(`/detectors/${provider}/key`, 'DELETE', undefined, 'Detector key removed')
      .then(() => setReturnFocus({ provider }))
      .catch(() => {});
  return { statuses, working, editing, setEditing, cancel: () => close(editing), save, remove };
};
