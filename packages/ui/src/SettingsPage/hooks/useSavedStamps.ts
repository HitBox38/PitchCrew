import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useEffect, useRef } from 'react';
import { observeSettingsSaves } from '../saved-stamps.ts';
import { persistedSetting } from '../persisted-setting.ts';

/** Confirm only the control the user changed, after its committed value reaches the DOM. */
export const useSavedStamps = () => {
  const root = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    return observeSettingsSaves(element, persistedSetting, (message) => {
      const failed = message.includes('session');
      if (status.current) status.current.textContent = failed ? '' : message;
      if (failed) useWorkspaceStore.getState().setToast(message, 'error');
    });
  }, []);
  return { root, status };
};
