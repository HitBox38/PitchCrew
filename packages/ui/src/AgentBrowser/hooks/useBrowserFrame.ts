import { useEffect, useState } from 'react';
import type { BrowserFrame } from '@pitchcrew/core';
import { streamBrowser } from '../api.ts';

export const useBrowserFrame = (roleId: string, threadId: string, enabled: boolean) => {
  const [state, setState] = useState<{
    key: string;
    enabled: boolean;
    frame: BrowserFrame | null;
    error: string;
  }>({
    key: '',
    enabled,
    frame: null,
    error: '',
  });
  const key = `${threadId}:${roleId}`;
  if (state.key !== key || state.enabled !== enabled)
    setState({ key, enabled, frame: null, error: '' });
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup, react-doctor/no-set-state-after-await-in-effect -- Cleanup clears the timer and prevents rescheduling after disposal.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const connect = async () => {
      try {
        await streamBrowser(roleId, threadId, controller.signal, (frame) => {
          if (!controller.signal.aborted) setState({ key, enabled, frame, error: '' });
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : 'Browser stream ended.',
          }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void connect(), 1200);
      }
    };
    void connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [roleId, threadId, enabled, key]);
  return state.key === key ? state : { key, frame: null, error: '' };
};
