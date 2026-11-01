import type { DesktopBrowserCapture } from '../../../core/src/native-browser.ts';

export const browserCaptureImage = (capture: DesktopBrowserCapture) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The browser screenshot could not be read.'));
    image.src = `data:image/png;base64,${capture.data}`;
  });

export const browserBlobBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('The browser artifact could not be read.'));
    reader.readAsDataURL(blob);
  });

export const browserCanvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser screenshot could not be exported.'));
    }, 'image/png'),
  );

export const browserRecordingType = () =>
  typeof MediaRecorder === 'undefined'
    ? undefined
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );

/** Record only the already-authorized page; no screen, microphone or desktop capture. */
export const recordBrowserPage = async (capture: () => Promise<DesktopBrowserCapture>) => {
  const mimeType = browserRecordingType();
  if (!mimeType) throw new Error('Browser recording is unavailable on this device.');
  const initial = await capture();
  const image = await browserCaptureImage(initial);
  const canvas = document.createElement('canvas');
  canvas.width = initial.width;
  canvas.height = initial.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser recording could not start.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const stream = canvas.captureStream(10);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_000_000 });
  } catch (cause) {
    for (const track of stream.getTracks()) track.stop();
    throw cause;
  }
  const chunks: Blob[] = [];
  let bytes = 0;
  let stopped = false;
  let error: Error | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (recorder.state !== 'inactive') recorder.stop();
  };
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      bytes += event.data.size;
      if (bytes > 45_000_000) stop();
      if (bytes <= 50_000_000) chunks.push(event.data);
      else error = new Error('The recording reached its 50 MB limit. Record a shorter clip.');
    };
    recorder.onerror = () => {
      error = new Error('Browser recording could not continue.');
      stop();
    };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      const blob = new Blob(chunks, { type: 'video/webm' });
      if (error || !blob.size) reject(error ?? new Error('The recording contained no frames.'));
      else resolve(blob);
    };
  });
  const started = performance.now();
  const frame = async () => {
    if (stopped) return;
    if (performance.now() - started >= 300_000) return stop();
    try {
      const next = await capture();
      if (stopped) return;
      const image = await browserCaptureImage(next);
      if (stopped) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      timer = setTimeout(() => void frame(), 100);
    } catch {
      // Preserve the clip captured so far when control or the page changes.
      stop();
    }
  };
  try {
    recorder.start(1000);
  } catch (cause) {
    for (const track of stream.getTracks()) track.stop();
    throw cause;
  }
  timer = setTimeout(() => void frame(), 100);
  return { stop, done };
};
