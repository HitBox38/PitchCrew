import type { Rectangle, WebContents } from 'electron';
import { z } from 'zod';

const captureSchema = z.object({
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().int().min(0).max(100).default(80),
  clip: z
    .object({
      x: z.number().finite().min(0),
      y: z.number().finite().min(0),
      width: z.number().finite().positive().max(10000),
      height: z.number().finite().positive().max(10000),
      scale: z.number().finite().positive().max(4).default(1),
    })
    .optional(),
});

// After the same frames that paint Playwright's credential masks, report where the visual
// viewport sits in the document, so the copy uses the scroll position that was painted.
const paintedViewport =
  'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => resolve({ x: visualViewport.pageLeft, y: visualViewport.pageTop }), 0))))';
const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

const waitForMaskPaint = async (contents: WebContents): Promise<unknown> => {
  if (!contents.isLoadingMainFrame())
    return contents.executeJavaScriptInIsolatedWorld(1001, [{ code: paintedViewport }]);
  // Electron queues executeJavaScriptInIsolatedWorld until did-stop-loading. A visible
  // form can keep loading a remote image long after its fields and masks have painted.
  const { frameTree } = await contents.debugger.sendCommand('Page.getFrameTree');
  const { executionContextId } = await contents.debugger.sendCommand('Page.createIsolatedWorld', {
    frameId: frameTree.frame.id,
    worldName: 'pitchcrew-capture-paint',
  });
  const { result } = await contents.debugger.sendCommand('Runtime.evaluate', {
    expression: paintedViewport,
    contextId: executionContextId,
    awaitPromise: true,
    returnByValue: true,
  });
  return positionSchema.parse(result.value);
};

/**
 * A CDP clip places its origin in document CSS pixels (Playwright sends the scroll position for
 * a viewport screenshot), but Electron copies a rect of the visible view in DIPs. Move the
 * origin by the painted scroll position and page zoom. Sizes stay as sent: Playwright sizes a
 * viewport clip from the view itself, so scaling them would overflow it.
 */
export const nativeCaptureOrigin = (
  clip: { x: number; y: number },
  position: { x: number; y: number },
  zoom: number,
) => {
  const origin = (value: number, scroll: number) => {
    const offset = (value - scroll) * zoom;
    // CDP metrics and the page can round a fractional scroll position differently.
    if (offset < -1) throw new Error('The page scrolled during capture. Try again.');
    return Math.max(0, Math.floor(offset));
  };
  return { x: origin(clip.x, position.x), y: origin(clip.y, position.y) };
};

// A timed-out Electron copy can still be running in Chromium. Keep the actual copy,
// rather than its caller's timeout, as the predecessor of the next capture.
interface CaptureQueue {
  generation: number;
  tail?: Promise<void>;
}
const captures = new WeakMap<WebContents, CaptureQueue>();
export const drainNativeCapture = async (contents: WebContents) => {
  if (contents.isDestroyed()) return;
  const tail = captures.get(contents)?.tail;
  if (!tail) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = () => {};
  try {
    await Promise.race([
      tail,
      new Promise<void>((resolve, reject) => {
        destroyed = resolve;
        contents.once('destroyed', destroyed);
        timer = setTimeout(
          () => reject(new Error('This browser tab is finishing a capture. Try closing it again.')),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    contents.removeListener('destroyed', destroyed);
  }
};
const captureQueue = (contents: WebContents) => {
  const existing = captures.get(contents);
  if (existing) return existing;
  const queue: CaptureQueue = { generation: 0 };
  const reset = () => {
    queue.generation++;
    queue.tail = undefined;
  };
  contents.on('did-navigate', reset);
  contents.on('render-process-gone', reset);
  contents.once('destroyed', () => {
    reset();
    contents.removeListener('did-navigate', reset);
    contents.removeListener('render-process-gone', reset);
  });
  captures.set(contents, queue);
  return queue;
};

/** CDP surface readback can stall in hidden Windows guests; Electron can capture while staying hidden. */
export const captureNativePage = async (
  contents: WebContents,
  params: Record<string, unknown>,
  displayScale = 1,
  current = () => true,
) => {
  const { format, quality, clip } = captureSchema.parse(params);
  const area = clip ? { width: Math.ceil(clip.width), height: Math.ceil(clip.height) } : undefined;
  if (area && area.width * area.height * (clip?.scale ?? 1) ** 2 > 16_000_000)
    throw new Error('Browser capture exceeds the viewport limit.');
  const queue = captureQueue(contents);
  const generation = queue.generation;
  let expired = false;
  let phase = 'waiting for the previous capture';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error(`Native browser capture timed out while ${phase}.`));
    }, 5000);
  });
  const assertCurrent = () => {
    if (expired) throw new Error('Native browser capture timed out.');
    if (queue.generation !== generation || !current())
      throw new Error('The page this capture was for has changed.');
  };
  const previous = queue.tail;
  const read = async () => {
    await previous;
    const retryUntil = Date.now() + 2000;
    for (;;) {
      assertCurrent();
      phase = 'waiting for credential masks to paint';
      // capturePage can copy the previous surface before Playwright's mask styles paint.
      // A separate world keeps the page from replacing these scheduling primitives.
      // A paint wait has not started a copy: expire it so an unanswered renderer
      // promise cannot poison the queue. A late paint result cannot reach readback.
      const painted = await Promise.race([waitForMaskPaint(contents), deadline]);
      assertCurrent();
      let rect: Rectangle | undefined;
      if (clip && area) {
        const position = positionSchema.safeParse(painted);
        if (!position.success)
          throw new Error('The native browser could not read the page position.');
        rect = { ...nativeCaptureOrigin(clip, position.data, contents.getZoomFactor()), ...area };
      }
      try {
        phase = 'copying the native page';
        const image = await contents.capturePage(rect, { stayHidden: true, stayAwake: true });
        assertCurrent();
        return { image, rect };
      } catch (error) {
        // Chromium can reject the first copy before its compositor surface is ready.
        // Keep retries in this same serialized copy, deadline and page generation.
        if (Date.now() >= retryUntil || !String(error).includes('UnknownVizError')) throw error;
        assertCurrent();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  };
  const pending = read();
  const complete = pending.then(
    () => {},
    () => {},
  );
  queue.tail = complete;
  void complete.then(() => {
    if (queue.tail === complete) queue.tail = undefined;
  });
  try {
    const { image: captured, rect } = await Promise.race([pending, deadline]);
    if (captured.isEmpty()) throw new Error('The native browser returned an empty image.');
    const size = captured.getSize();
    const logicalSize = rect && size.width === rect.width && size.height === rect.height;
    // Electron can return physical backing pixels even when CDP emulates DPR 1.
    // Accept only the owning display's exact scale, never an arbitrary viewport mismatch.
    const backingSize =
      rect &&
      size.width === Math.round(rect.width * displayScale) &&
      size.height === Math.round(rect.height * displayScale);
    if (rect && !logicalSize && !backingSize)
      throw new Error('The native browser viewport changed. Resize and inspect again.');
    const width = Math.max(
      1,
      Math.round(clip ? clip.width * clip.scale : size.width / displayScale),
    );
    const height = Math.max(
      1,
      Math.round(clip ? clip.height * clip.scale : size.height / displayScale),
    );
    const image =
      size.width === width && size.height === height
        ? captured
        : captured.resize({ width, height });
    return { data: (format === 'jpeg' ? image.toJPEG(quality) : image.toPNG()).toString('base64') };
  } finally {
    clearTimeout(timer);
  }
};
