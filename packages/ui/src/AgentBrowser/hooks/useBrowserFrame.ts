import { useEffect, useState, useSyncExternalStore } from 'react';
import type { BrowserFrame } from '@pitchcrew/core';
import { streamBrowser } from '../api.ts';
import { browserFramePresenter } from '../frame-presenter.ts';

export const useBrowserFrame = (roleId: string, threadId: string, requested: boolean) => {
  const visible = useSyncExternalStore(subscribeVisibility, isVisible);
  const enabled = requested && visible;
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
      const presenter = browserFramePresenter(
        (frame) => {
          if (!controller.signal.aborted) setState({ key, enabled, frame, error: '' });
        },
        () => {
          if (!controller.signal.aborted)
            setState({ key, enabled, frame: null, error: 'Could not display the browser view.' });
        },
      );
      try {
        await streamBrowser(roleId, threadId, controller.signal, presenter.push);
      } catch (error) {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            frame: null,
            error: error instanceof Error ? error.message : 'Browser stream ended.',
          }));
      } finally {
        presenter.close();
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

const isVisible = () => document.visibilityState !== 'hidden';
const subscribeVisibility = (change: () => void) => {
  document.addEventListener('visibilitychange', change);
  return () => document.removeEventListener('visibilitychange', change);
};
