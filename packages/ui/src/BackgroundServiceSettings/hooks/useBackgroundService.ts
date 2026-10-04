import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { useEffect, useState } from 'react';
import { loadBackgroundService } from '../api.ts';

export function useBackgroundService() {
  const [info, setInfo] = useState<BackgroundServiceInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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
  return { info, error, loading, checkAgain };
}
