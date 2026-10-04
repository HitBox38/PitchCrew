import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Liberation Sans ships with pdfjs-dist, which the UI already bundles for PDF previews. It is
// metrically compatible with Arial and covers Latin, Greek, Cyrillic and common punctuation.
// Its license (GPL v2 with a font exception) lets documents embed it without changing their terms.
export type FontStyle = 'regular' | 'bold' | 'italic' | 'boldItalic';
export const fontStyles: FontStyle[] = ['regular', 'bold', 'italic', 'boldItalic'];
const files: Record<FontStyle, string> = {
  regular: 'LiberationSans-Regular.ttf',
  bold: 'LiberationSans-Bold.ttf',
  italic: 'LiberationSans-Italic.ttf',
  boldItalic: 'LiberationSans-BoldItalic.ttf',
};
// Fixed subset tags keep embedded font names, and therefore PDF bytes, deterministic.
export const subsetNames: Record<FontStyle, string> = {
  regular: 'PCREWA+LiberationSans',
  bold: 'PCREWB+LiberationSans-Bold',
  italic: 'PCREWC+LiberationSans-Italic',
  boldItalic: 'PCREWD+LiberationSans-BoldItalic',
};

const require = createRequire(import.meta.url);
const cache = new Map<FontStyle, Promise<Uint8Array>>();

export function fontBytes(style: FontStyle) {
  let bytes = cache.get(style);
  if (!bytes) {
    bytes = readFile(require.resolve(`pdfjs-dist/standard_fonts/${files[style]}`));
    bytes.catch(() => cache.delete(style));
    cache.set(style, bytes);
  }
  return bytes;
}

export const styleOf = (run: { bold: boolean; italic: boolean }): FontStyle =>
  run.bold ? (run.italic ? 'boldItalic' : 'bold') : run.italic ? 'italic' : 'regular';
