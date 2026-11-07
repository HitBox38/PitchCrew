import { useState } from 'react';
import type { RuntimeConnectionState, RuntimeId } from '@pitchcrew/core';
import { api } from '@/api.ts';
export const useConnectionRecovery = ({
  runtime,
  reload,
  onWorkingChange,
  onSaved,
  onRecovered,
}: {
  runtime: RuntimeId;
  reload: () => Promise<boolean>;
  onWorkingChange: (value: boolean) => void;
  onSaved: () => void;
  onRecovered: (backup: string) => void;
}) => {
  const [working, setWorking] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState('');
  const recover = async () => {
    setWorking(true);
    onWorkingChange(true);
    setError('');
    try {
      if (!reset) {
        const result = await api<RuntimeConnectionState & { backup: string }>(
          `/runtimes/${runtime}/connection/recover`,
          'POST',
          {
            confirmed: true,
          },
        );
        setReset(true);
        onRecovered(result.backup);
        onSaved();
      }
      if (await reload()) return true;
      else
        setError(
          'Authentication settings were reset and the backup was kept, but the list could not refresh. Retry loading or close this dialog.',
        );
    } catch {
      setError(
        'Recovery could not complete. Wait for runtime work to finish and check workspace storage before retrying.',
      );
    } finally {
      setWorking(false);
      onWorkingChange(false);
    }
    return false;
  };
  return { working, error, reset, recover };
};
