import type { BrowserFrameEvent } from './types.ts';

/** One pending frame per viewer. Slow consumers skip obsolete images. */
export const latestFrames = (signal: AbortSignal) => {
  let latest: BrowserFrameEvent | undefined;
  let wake: (() => void) | undefined;
  const abort = () => wake?.();
  signal.addEventListener('abort', abort, { once: true });
  return {
    push: (event: BrowserFrameEvent) => {
      // A later image must not hide a terminal failure.
      if (latest && 'error' in latest) return;
      latest = event;
      wake?.();
    },
    next: async () => {
      if (!latest && !signal.aborted)
        await new Promise<void>((resolve) => {
          wake = resolve;
          if (signal.aborted || latest) resolve();
        });
      wake = undefined;
      const event = latest;
      latest = undefined;
      return signal.aborted ? undefined : event;
    },
    close: () => {
      signal.removeEventListener('abort', abort);
      latest = undefined;
      wake?.();
    },
  };
};
