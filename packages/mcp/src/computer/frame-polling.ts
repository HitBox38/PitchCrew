import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserFrameListener } from './types.ts';

/** Shared compatibility fallback for drivers without screencast support. */
export const pollingFrames = (capture: () => Promise<BrowserFrame | null>) => {
  const listeners = new Set<BrowserFrameListener>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const poll = async (version: number) => {
    try {
      const frame = await capture();
      if (version !== generation) return;
      for (const receive of listeners)
        receive(frame ? { ...frame, status: 'fallback' } : { error: 'Browser is closed.' });
    } catch {
      if (version === generation)
        for (const receive of listeners) receive({ error: 'Could not update the browser view.' });
    }
    if (listeners.size && version === generation) timer = setTimeout(() => void poll(version), 500);
  };
  const close = () => {
    generation++;
    clearTimeout(timer);
    for (const receive of listeners) receive({ error: 'Browser is closed.' });
    listeners.clear();
  };
  return {
    subscribe: (receive: BrowserFrameListener) => {
      listeners.add(receive);
      if (listeners.size === 1) void poll(++generation);
      return () => {
        listeners.delete(receive);
        if (!listeners.size) close();
      };
    },
    close,
  };
};
