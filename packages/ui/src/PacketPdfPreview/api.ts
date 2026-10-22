import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import fontUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';

export const renderPdf = async (bytes: string, signal: AbortSignal) => {
  const task = await localPdfTask(bytes);
  const abort = () => {
    void task.destroy().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const document = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      signal.throwIfAborted();
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Sequential page rendering bounds canvas memory and preserves page order.
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Release this page before allocating the next canvas.
      await page.render({ canvas, viewport }).promise;
      pages.push(canvas.toDataURL('image/png'));
      page.cleanup();
    }
    signal.throwIfAborted();
    return pages;
  } finally {
    signal.removeEventListener('abort', abort);
    await task.destroy();
  }
};

class LocalBinaryData {
  fetch = async ({ kind, filename }: { kind: string; filename: string }) => {
    if (kind !== 'standardFontDataUrl' || filename !== 'LiberationSans-Regular.ttf')
      throw new Error('Unexpected PDF resource.');
    const response = await fetch(fontUrl);
    if (!response.ok) throw new Error('Local PDF font failed to load.');
    return new Uint8Array(await response.arrayBuffer());
  };
}

export const localPdfTask = async (bytes: string) => {
  const pdf = await import('pdfjs-dist');
  pdf.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const options = {
    data: Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0)),
    useWorkerFetch: false,
    useSystemFonts: false,
    useWasm: false,
    disableFontFace: true,
    isEvalSupported: false,
    stopAtErrors: true,
    enableXfa: false,
    BinaryDataFactory: LocalBinaryData,
  };
  return pdf.getDocument(options);
};
