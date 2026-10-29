import type { WebContents } from 'electron';
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
  const rect = clip
    ? {
        x: Math.floor(clip.x),
        y: Math.floor(clip.y),
        width: Math.ceil(clip.width),
        height: Math.ceil(clip.height),
      }
    : undefined;
  if (rect && rect.width * rect.height * (clip?.scale ?? 1) ** 2 > 16_000_000)
    throw new Error('Browser capture exceeds the viewport limit.');
  const queue = captureQueue(contents);
  const generation = queue.generation;
  let expired = false;
  const assertCurrent = () => {
    if (expired) throw new Error('Native browser capture timed out.');
    if (queue.generation !== generation || !current())
      throw new Error('The page this capture was for has changed.');
  };
  const previous = queue.tail;
  const read = async () => {
    await previous;
    assertCurrent();
    // capturePage can copy the previous surface before Playwright's mask styles paint.
    // A separate world keeps the page from replacing these scheduling primitives.
    await contents.executeJavaScriptInIsolatedWorld(1001, [
      {
        code: 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))))',
      },
    ]);
    assertCurrent();
    const image = await contents.capturePage(rect, { stayHidden: true, stayAwake: true });
    assertCurrent();
    return image;
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const captured = await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('Native browser capture timed out.'));
        }, 5000);
      }),
    ]);
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
