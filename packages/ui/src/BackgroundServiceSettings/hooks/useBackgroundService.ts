import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { useEffect, useRef, useState } from 'react';
import { installBackgroundService, loadBackgroundService } from '../api.ts';

export const useBackgroundService = () => {
  const [info, setInfo] = useState<BackgroundServiceInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const installPending = useRef(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void loadBackgroundService(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setInfo(result);
        setError('');
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not check the background service.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  const checkAgain = () => {
    setLoading(true);
    setRefresh((count) => count + 1);
  };
  const install = async () => {
    if (loading || installPending.current) return;
    installPending.current = true;
    setInstalling(true);
    setError('');
    try {
      setInfo(await installBackgroundService());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not install the background service.',
      );
    } finally {
      installPending.current = false;
      setInstalling(false);
    }
  };
  return { info, error, loading, installing, checkAgain, install };
};
