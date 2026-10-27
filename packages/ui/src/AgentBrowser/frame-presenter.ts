import type { BrowserFrame } from '@pitchcrew/core';

/** Decode one image at a time, retaining only the newest pending frame. */
export const browserFramePresenter = (
  receive: (frame: BrowserFrame) => void,
  failed: () => void,
) => {
  let pending: BrowserFrame | undefined;
  let decoding = false;
  let closed = false;
  let epoch = 0;
  let generation: number | undefined;
  let animation: number | undefined;
  let releaseAnimation: (() => void) | undefined;
  const present = async () => {
    if (closed || decoding || !pending) return;
    const frame = pending;
    const version = epoch;
    pending = undefined;
    decoding = true;
    const image = new Image();
    image.src = `data:image/jpeg;base64,${frame.screenshot}`;
    try {
      await image.decode();
      if (closed || version !== epoch) return;
      await new Promise<void>((resolve) => {
        releaseAnimation = resolve;
        animation = requestAnimationFrame(() => {
          animation = undefined;
          releaseAnimation = undefined;
          if (!closed && version === epoch) receive(frame);
          resolve();
        });
      });
    } catch {
      if (!closed && version === epoch) failed();
    } finally {
      decoding = false;
      if (!closed) void present();
    }
  };
  return {
    push: (frame: BrowserFrame) => {
      if (closed) return;
      if (frame.generation !== generation || !frame.screenshot) {
        generation = frame.generation;
        epoch++;
        pending = undefined;
        receive({ ...frame, screenshot: '', status: 'loading' });
      }
      if (frame.screenshot) {
        pending = frame;
        void present();
      }
    },
    close: () => {
      closed = true;
      epoch++;
      pending = undefined;
      if (animation !== undefined) cancelAnimationFrame(animation);
      releaseAnimation?.();
    },
  };
};
