import type { recordOptions, eventWithTime } from 'posthog-js/rrweb';
import { replayBlockSelector, sanitizeReplayEvent, wireframeGeometry } from './privacy';

type Recorder = {
  record: (options: recordOptions<eventWithTime>) => (() => void) | undefined;
  node: (id: number) => Node | null;
};
export type ReplayTransport = (events: Record<string, unknown>[]) => void;

export const createReplay = (
  load: () => Promise<Recorder>,
  allowed: () => boolean,
  send: ReplayTransport,
) => {
  let generation = 0;
  let stopRecording: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let events: Record<string, unknown>[] = [];
  let bytes = 0;
  const stop = () => {
    ++generation;
    const cleanup = stopRecording;
    stopRecording = undefined;
    events = [];
    bytes = 0;
    if (timer) clearInterval(timer);
    timer = undefined;
    try {
      cleanup?.();
    } catch {
      /* Best effort teardown. */
    }
  };
  const flush = () => {
    const batch = events;
    events = [];
    bytes = 0;
    if (!allowed()) {
      stop();
      return;
    }
    if (batch.length) {
      try {
        send(batch);
      } catch {
        /* No retry queue. */
      }
    }
  };
  return {
    stop,
    setEnabled: async (enabled: boolean) => {
      if (!enabled || !allowed()) {
        stop();
        return;
      }
      if (stopRecording) return;
      const current = ++generation;
      try {
        const recorder = await load();
        if (current !== generation || !allowed()) return;
        const cleanup = recorder.record({
          blockSelector: replayBlockSelector,
          maskTextSelector: '*',
          maskTextFn: () => '[masked]',
          maskAllInputs: true,
          maskInputFn: () => '[masked]',
          maskAllElementAttributes: true,
          inlineStylesheet: false,
          inlineImages: false,
          collectFonts: false,
          recordCanvas: false,
          recordCrossOriginIframes: false,
          slimDOMOptions: 'all',
          plugins: [],
          sampling: { mousemove: 200, scroll: 200, input: 'last', media: 100000 },
          checkoutEveryNms: 30000,
          emit: (input) => {
            if (current !== generation || !allowed()) {
              stop();
              return;
            }
            const event = sanitizeReplayEvent(input, (id) => wireframeGeometry(recorder.node(id)));
            if (!event) return;
            const size = JSON.stringify(event).length;
            if (size > 500000) {
              stop();
              return;
            }
            if (bytes + size > 500000 || events.length >= 1000) flush();
            if (current !== generation || !allowed()) return;
            events.push(event);
            bytes += size;
          },
        });
        if (current !== generation || !allowed()) {
          cleanup?.();
          return;
        }
        stopRecording = cleanup;
        if (cleanup) timer = setInterval(flush, 5000);
      } catch {
        stop();
      }
    },
  };
};

export const loadLocalRecorder = async (): Promise<Recorder> => {
  const { record } = await import('posthog-js/rrweb');
  return { record, node: (id) => record.mirror.getNode(id) };
};
