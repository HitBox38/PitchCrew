import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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

// The Hebrew fallback ships in packages/packet/fonts: unmodified Noto Sans Hebrew 3.001 under the
// SIL Open Font License (fonts/OFL.txt). It has no italics.
export interface BundledFont {
  path: string;
  name: string;
  bold: boolean;
  subsetName: string;
}
const bundled = (file: string, bold: boolean, tag: string): BundledFont => ({
  path: fileURLToPath(new URL(`../../fonts/${file}.ttf`, import.meta.url)),
  name: file,
  bold,
  subsetName: `${tag}+${file}`,
});
export const bundledFonts: BundledFont[] = [
  bundled('NotoSansHebrew-Regular', false, 'PCREWE'),
  bundled('NotoSansHebrew-Bold', true, 'PCREWF'),
];

const require = createRequire(import.meta.url);
const cache = new Map<string, Promise<Uint8Array>>();
const cacheLimit = 16;
const cachedSize = 4 * 1024 * 1024;

// Small font files are read once per change. System CJK fonts can be 20 MB, so they are read again
// for each document instead of staying in memory.
export async function readFont(path: string): Promise<Uint8Array> {
  const info = await stat(path);
  if (info.size > cachedSize) return readFile(path);
  const key = `${path}\0${info.size}\0${info.mtimeMs}`;
  let bytes = cache.get(key);
  if (!bytes) {
    bytes = readFile(path);
    bytes.catch(() => cache.delete(key));
    cache.set(key, bytes);
    if (cache.size > cacheLimit) cache.delete(cache.keys().next().value!);
  }
  return bytes;
}

export const fontBytes = (style: FontStyle) =>
  readFont(require.resolve(`pdfjs-dist/standard_fonts/${files[style]}`));

export const styleOf = (run: { bold: boolean; italic: boolean }): FontStyle =>
  run.bold ? (run.italic ? 'boldItalic' : 'bold') : run.italic ? 'italic' : 'regular';
