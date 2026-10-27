import { useCallback, useEffect, useState } from 'react';
import type {
  BrowserProfilesCommand,
  BrowserProfilesState,
} from '../../../../core/src/browser-profiles.ts';
export const useNativeProfiles = (id: string) => {
  const [state, setState] = useState<BrowserProfilesState | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(
    async (command: BrowserProfilesCommand) => {
      setWorking(true);
      setError('');
      if (command.kind === 'list') setState(null);
      try {
        const next = await window.pitchcrewBrowser!.profiles(id, command);
        setState(next);
        return true;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Browser profile update failed.');
        return false;
      } finally {
        setWorking(false);
      }
    },
    [id],
  );
  const token = state?.preview?.token;
  useEffect(
    () => () => {
      if (token)
        void window.pitchcrewBrowser
          ?.profiles(id, { kind: 'cancel-import', token })
          .catch(() => {});
    },
    [id, token],
  );
  return { state, working, error, run };
};
export type NativeProfilesModel = ReturnType<typeof useNativeProfiles>;
