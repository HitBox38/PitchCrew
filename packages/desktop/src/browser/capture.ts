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

/** CDP surface readback can stall in hidden Windows guests; Electron can capture while staying hidden. */
export const captureNativePage = async (contents: WebContents, params: Record<string, unknown>) => {
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
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const captured = await Promise.race([
      contents.capturePage(rect, { stayHidden: true, stayAwake: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Native browser capture timed out.')), 5000);
      }),
    ]);
    if (captured.isEmpty()) throw new Error('The native browser returned an empty image.');
    const size = captured.getSize();
    if (rect && (size.width !== rect.width || size.height !== rect.height))
      throw new Error('The native browser viewport changed. Resize and inspect again.');
    const width = clip ? Math.max(1, Math.round(clip.width * clip.scale)) : size.width;
    const height = clip ? Math.max(1, Math.round(clip.height * clip.scale)) : size.height;
    const image =
      size.width === width && size.height === height
        ? captured
        : captured.resize({ width, height });
    return { data: (format === 'jpeg' ? image.toJPEG(quality) : image.toPNG()).toString('base64') };
  } finally {
    clearTimeout(timer);
  }
};
