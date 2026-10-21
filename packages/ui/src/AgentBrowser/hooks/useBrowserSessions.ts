import { useCallback, useEffect, useState } from 'react';
import type { BrowserSessionInfo } from '@pitchcrew/core';
import { browserSessions } from '../api.ts';

export const useBrowserSessions = (threadId: string, enabled: boolean) => {
  const [state, setState] = useState<{
    thread: string;
    sessions: BrowserSessionInfo[];
    error: string;
  }>({ thread: threadId, sessions: [], error: '' });
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const sessions = await browserSessions(threadId);
    setState({ thread: threadId, sessions, error: '' });
  }, [threadId, enabled]);
  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup, react-doctor/no-set-state-after-await-in-effect -- Cleanup clears the timer and prevents rescheduling after disposal.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const sessions = await browserSessions(threadId, controller.signal);
        if (!controller.signal.aborted) setState({ thread: threadId, sessions, error: '' });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : 'Browser status unavailable.',
          }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void poll(), 1200);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [threadId, enabled]);
  return {
    ...(state.thread === threadId ? state : { thread: threadId, sessions: [], error: '' }),
    refresh,
  };
};
