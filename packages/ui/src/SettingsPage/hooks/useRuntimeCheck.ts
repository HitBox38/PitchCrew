import { useState } from 'react';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { runtimeUpdateCount } from '@/RuntimeMaintenance/helpers.ts';

export const useRuntimeCheck = () => {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const check = async () => {
    setChecking(true);
    setError('');
    try {
      await useWorkspaceStore.getState().action('/runtimes/detect', 'POST');
      const store = useWorkspaceStore.getState();
      const maintenance = store.data?.runtimeMaintenance;
      const count = runtimeUpdateCount(store.data?.runtimes ?? [], maintenance?.updates);
      const unknown = maintenance?.updates.some(
        (entry) =>
          entry.status === 'unknown' ||
          (entry.checkedAt && entry.checkedAt !== entry.lastSuccessAt),
      );
      store.setToast(
        !maintenance?.enabled
          ? 'Installed runtimes checked.'
          : count
            ? `${count} runtime ${count === 1 ? 'update is' : 'updates are'} available.`
            : unknown
              ? 'Some updates could not be checked. See runtime details.'
              : 'Runtime check complete. No updates found.',
        unknown ? 'info' : 'success',
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not check runtimes. Try again.');
    } finally {
      setChecking(false);
    }
  };
  return { checking, error, check };
};
