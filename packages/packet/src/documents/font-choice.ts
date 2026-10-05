import fontkit from '@pdf-lib/fontkit';
import type { Font } from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';
import type { FontLocation, FontSearch } from './font-search.ts';
import { documentFontkit, isCollection } from './fontkit.ts';
import {
  bundledFonts,
  fontBytes,
  type FontStyle,
  fontStyles,
  readFont,
  subsetNames,
} from './fonts.ts';
import type { DocumentKind } from './types.ts';

/** A fallback font face: a bundled font or one face of a font file found by the search. */
export interface FallbackFace {
  name: string;
  family: string;
  bold: boolean;
  bytes: Uint8Array;
  face?: string;
  font: Font;
  subsetName?: string;
}
/** Liberation Sans in the run's own style, or a fallback face. */
export type FontKey = FontStyle | FallbackFace;

const labels: Record<DocumentKind, string> = { resume: 'resume', coverLetter: 'cover letter' };
const isMark = (character: string) => /\p{M}/u.test(character);
export const isBidiControl = (character: string) =>
  /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(character);
const isCjk = (character: string) =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\u3000-\u303f\uff00-\uffef]/u.test(
    character,
  );
const isBold = (font: Font) =>
  ((font as Font & { 'OS/2'?: { usWeightClass?: number } })['OS/2']?.usWeightClass ?? 400) >= 600;

// Scripts whose letters change shape with their neighbours or are reordered. fontkit can shape
// them, but pdf-lib maps each glyph to one character, and fonts such as Noto Sans Arabic share one
// glyph between several letters, so copied or parsed text would come out wrong. They stay DOCX only.
const shapedScripts: [RegExp, string][] = [
  [/[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u, 'joins its letters'],
  [
    /[\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Tibetan}\p{Script=Mongolian}]/u,
    'reorders and combines its letters',
  ],
];

const code = (character: string) =>
  character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');

export function unshapedCharacter(character: string, kind: DocumentKind) {
  const script = shapedScripts.find(([pattern]) => pattern.test(character));
  if (!script) return undefined;
  return new Error(
    `PDF text contains unsupported characters: "${character}" (U+${code(character)}) in the ${labels[kind]}. Its script ${script[1]}, which PDF export does not support yet. Use DOCX or revise the packet; no text was omitted.`,
  );
}

export function unsupportedCharacter(character: string, kind: DocumentKind) {
  const advice = isCjk(character)
    ? 'Install a Japanese, Chinese or Korean font such as Noto Sans CJK or Yu Gothic, or copy one into the fonts folder in the Pitchcrew data folder. You can also use DOCX or revise the packet'
    : 'Copy a font that has it into the fonts folder in the Pitchcrew data folder, use DOCX or revise the packet';
  return new Error(
    `PDF text contains unsupported characters: "${character}" (U+${code(character)}) in the ${labels[kind]}. No available font has it. ${advice}; no text was omitted.`,
  );
}

// Faces pdf-lib can subset and embed as outlines: TrueType or CFF, not variable, not bitmap only.
function usable(font: Font | null | undefined): font is Font {
  const tables = (font as (Font & { directory?: { tables: Record<string, unknown> } }) | null)
    ?.directory?.tables;
  if (!font || !tables?.cmap) return false;
  if (tables.fvar || tables.CFF2 || tables.CBDT || tables.sbix) return false;
  return !!(tables.glyf || tables['CFF ']);
}

function face(bytes: Uint8Array, font: Font, collection: boolean): FallbackFace {
  const name = font.postscriptName ?? 'Fallback';
  return {
    name,
    family: font.familyName ?? name,
    bold: isBold(font),
    bytes,
    face: collection ? name : undefined,
    font,
  };
}

async function openFaces(location: FontLocation): Promise<FallbackFace[]> {
  try {
    const bytes = await readFont(location.path);
    const opened: unknown = fontkit.create(bytes);
    if (!isCollection(opened))
      return usable(opened as Font) ? [face(bytes, opened as Font, false)] : [];
    // Collection faces are chosen by PostScript name when the document embeds them.
    const fonts = opened.fonts.filter((font) => usable(font) && font.postscriptName);
    const named = fonts.filter((font) => font.postscriptName === location.face);
    return (named.length ? named : fonts).map((font) => face(bytes, font, true));
  } catch {
    return [];
  }
}

/**
 * Chooses a font for every character: Liberation Sans first, then the bundled Hebrew fonts, then
 * the fonts the search finds. Combining marks stay with their base character's font.
 */
export class FontChoice {
  private faces: FallbackFace[] = [];
  private searched = false;
  private usedStyles = new Set<FontStyle>(['regular']);
  private usedFaces: FallbackFace[] = [];

  private constructor(
    private main: Record<FontStyle, Font>,
    private search: FontSearch,
  ) {}

  static async open(search: FontSearch) {
    const main = {} as Record<FontStyle, Font>;
    for (const style of fontStyles) main[style] = fontkit.create(await fontBytes(style));
    const choice = new FontChoice(main, search);
    for (const font of bundledFonts) {
      const bytes = await readFont(font.path);
      choice.faces.push({ ...face(bytes, fontkit.create(bytes), false), ...font });
    }
    return choice;
  }

  covers(key: FontKey, code: number) {
    return (typeof key === 'string' ? this.main[key] : key.font).hasGlyphForCodePoint(code);
  }

  private fontFor(character: string, style: FontStyle, previous?: FontKey) {
    const code = character.codePointAt(0)!;
    if (character === ' ' || this.covers(style, code)) return style;
    if (previous !== undefined && isMark(character) && this.covers(previous, code)) return previous;
    const first = this.faces.find((item) => item.font.hasGlyphForCodePoint(code));
    const bold = style === 'bold' || style === 'boldItalic';
    if (!first || first.bold === bold) return first;
    // Prefer the matching weight of the same family, such as a separate bold file.
    return (
      this.faces.find(
        (item) =>
          item.family === first.family &&
          item.bold === bold &&
          item.font.hasGlyphForCodePoint(code),
      ) ?? first
    );
  }

  /** One font per code point of already cleaned text; bidi controls get the run's style. */
  fonts(text: string, style: FontStyle): FontKey[] {
    const keys: FontKey[] = [];
    let previous: FontKey | undefined;
    for (const character of text) {
      const key = isBidiControl(character) ? style : this.fontFor(character, style, previous);
      if (!key) throw new Error(`No font for U+${character.codePointAt(0)!.toString(16)}.`);
      keys.push(key);
      previous = key;
    }
    return keys;
  }

  /** Finds a font for every character, searching for fonts only when the bundled ones miss. */
  async cover(texts: { text: string; style: FontStyle }[], kind: DocumentKind) {
    for (const { text, style } of texts) {
      // Every run style is embedded, as before fallback fonts, so earlier documents keep their bytes.
      this.usedStyles.add(style);
      let previous: FontKey | undefined;
      for (const character of text) {
        if (isBidiControl(character)) continue;
        const unshaped = unshapedCharacter(character, kind);
        if (unshaped) throw unshaped;
        let key = this.fontFor(character, style, previous);
        if (!key && !this.searched) {
          this.searched = true;
          for (const location of await this.search())
            this.faces.push(...(await openFaces(location)));
          key = this.fontFor(character, style, previous);
        }
        if (!key) throw unsupportedCharacter(character, kind);
        if (typeof key !== 'string' && !this.usedFaces.includes(key)) this.usedFaces.push(key);
        previous = key;
      }
    }
  }

  /**
   * Embeds the fonts `cover` found, Liberation Sans styles first and fallbacks in order of first
   * use, with fixed subset names. Searched faces are named by position and PostScript name, so the
   * same text and fonts give the same bytes without recording file paths.
   */
  async embed(document: PDFDocument) {
    const kit = documentFontkit();
    document.registerFontkit(kit.fontkit);
    const embedded = new Map<FontKey, PDFFont>();
    // Fallback fonts keep their fontkit font, so marks can be placed where the font puts them.
    const shaped = new Map<PDFFont, Font>();
    const embed = async (
      bytes: Uint8Array,
      face: string | undefined,
      name: string,
      repair: boolean,
    ) => {
      const { key, font } = kit.prepare(bytes, face, repair);
      const pdfFont = await document.embedFont(key, {
        subset: true,
        customName: name,
        features: { liga: false },
      });
      if (repair) shaped.set(pdfFont, font);
      return pdfFont;
    };
    for (const style of fontStyles)
      if (this.usedStyles.has(style))
        embedded.set(
          style,
          await embed(await fontBytes(style), undefined, subsetNames[style], false),
        );
    let searched = 0;
    for (const face of this.usedFaces) {
      const tag = `PCRX${String.fromCharCode(65 + Math.floor(searched / 26), 65 + (searched % 26))}`;
      const name = face.subsetName ?? `${tag}+${face.name.replace(/[^\w-]/g, '').slice(0, 56)}`;
      if (!face.subsetName) searched++;
      embedded.set(face, await embed(face.bytes, face.face, name, true));
    }
    return { embedded, shaped };
  }
}
