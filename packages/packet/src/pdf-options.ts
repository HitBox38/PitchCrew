import { fileURLToPath } from 'node:url';

/** Local text extraction only; PDF.js validates '/' even for native Windows paths. */
export const pdfOptions = (bytes: Uint8Array) => ({
  data: new Uint8Array(bytes),
  isEvalSupported: false,
  useSystemFonts: false,
  useWorkerFetch: false,
  disableFontFace: true,
  useWasm: false,
  enableXfa: false,
  standardFontDataUrl: fileURLToPath(
    new URL('../../standard_fonts/', import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs')),
  ).replaceAll('\\', '/'),
});
