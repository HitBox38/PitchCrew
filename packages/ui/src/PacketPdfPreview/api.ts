import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import fontUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';

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
