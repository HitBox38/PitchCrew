import type { BrowserFrame } from '@pitchcrew/core';
import type { Page, Disposable } from 'playwright';
import type { BrowserFrameListener } from './types.ts';

type Source = {
  page: () => Page;
  metadata: () => Omit<BrowserFrame, 'screenshot'>;
  capture: () => Promise<BrowserFrame>;
  screencast?: boolean;
};

/** Viewer-only images. Agent evidence always uses the independent snapshot path. */
export const browserFrameStream = (source: Source) => {
  const listeners = new Set<BrowserFrameListener>();
  let generation = 0;
  let latest: BrowserFrame | undefined;
  let disposable: Disposable | undefined;
  let transition = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let metadataTimer: ReturnType<typeof setInterval> | undefined;
  let title = '';
  let readingTitle = false;
  let closed = false;
  let fallback = false;
  const current = (version: number, page: Page) =>
    !closed && listeners.size > 0 && version === generation && source.page() === page;
  const publish = (frame: BrowserFrame) => {
    latest = frame;
    for (const receive of listeners) receive(frame);
  };
  const metadata = () => ({ ...source.metadata(), title, generation });
  const refresh = () => {
    const state = metadata();
    if (latest) {
      const next = { ...latest, ...state, warning: state.warning, dialog: state.dialog };
      if (
        next.url !== latest.url ||
        next.title !== latest.title ||
        next.warning !== latest.warning ||
        JSON.stringify(next.dialog) !== JSON.stringify(latest.dialog)
      )
        publish(next);
    }
    if (!readingTitle && !state.dialog && !source.page().isClosed()) {
      const page = source.page();
      const version = generation;
      readingTitle = true;
      void page
        .title()
        .then((value) => {
          if (current(version, page)) title = value;
        })
        .catch(() => {})
        .finally(() => {
          readingTitle = false;
        });
    }
  };
  const failure = () => {
    for (const receive of listeners) receive({ error: 'Could not update the browser view.' });
  };
  const poll = async (version: number, page: Page) => {
    try {
      const frame = await source.capture();
      if (!current(version, page)) return;
      if (frame.screenshot.length > 1_800_000) throw new Error('Frame too large.');
      publish({ ...frame, generation: version, status: 'fallback' });
    } catch {
      if (current(version, page)) failure();
    }
    if (current(version, page)) timer = setTimeout(() => void poll(version, page), 500);
  };
  const useFallback = (version: number, page: Page) => {
    if (!current(version, page) || fallback) return;
    fallback = true;
    // Stop only this subscription; do not stop another Playwright capture consumer.
    transition = transition.then(async () => {
      await disposable?.dispose().catch(() => {});
      disposable = undefined;
      if (current(version, page)) void poll(version, page);
    });
  };
  const restart = () => {
    generation++;
    const version = generation;
    clearTimeout(timer);
    clearInterval(metadataTimer);
    title = '';
    fallback = false;
    latest = undefined;
    if (listeners.size && !closed) {
      publish({ ...metadata(), screenshot: '', status: 'loading' });
      metadataTimer = setInterval(refresh, 300);
    }
    transition = transition.then(async () => {
      await disposable?.dispose().catch(() => {});
      disposable = undefined;
      if (closed || version !== generation || !listeners.size) return;
      const page = source.page();
      refresh();
      if (source.screencast === false) {
        useFallback(version, page);
        return;
      }
      try {
        disposable = await page.screencast.start({
          quality: 60,
          size: { width: 2560, height: 2160 },
          onFrame: ({ data, viewportWidth, viewportHeight }) => {
            if (!current(version, page) || fallback) return;
            const state = metadata();
            if (viewportWidth !== state.width || viewportHeight !== state.height) return;
            if (data.byteLength > 1_350_000) {
              useFallback(version, page);
              return;
            }
            clearTimeout(timer);
            publish({ ...state, screenshot: data.toString('base64'), status: 'live' });
          },
        });
        if (!current(version, page)) return;
        // Static pages should yield a first frame too. Fall back if capture cannot start painting.
        if (!fallback && latest?.status !== 'live')
          timer = setTimeout(() => useFallback(version, page), 1500);
      } catch {
        useFallback(version, page);
      }
    });
  };
  return {
    get generation() {
      return generation;
    },
    subscribe: (receive: BrowserFrameListener) => {
      if (closed) {
        receive({ error: 'Browser is closed.' });
        return () => {};
      }
      listeners.add(receive);
      if (listeners.size === 1) restart();
      else if (latest) receive(latest);
      return () => {
        listeners.delete(receive);
        if (!listeners.size) restart();
      };
    },
    reset: restart,
    refresh,
    close: async () => {
      closed = true;
      for (const receive of listeners) receive({ error: 'Browser is closed.' });
      listeners.clear();
      restart();
      await transition;
    },
  };
};
