import fontkit from '@pdf-lib/fontkit';
import type { Font, Glyph, GlyphRun } from '@pdf-lib/fontkit';

// pdf-lib lays out text through fontkit with nothing but the text and font features. Text that
// starts with this noncharacter is a right-to-left run in logical order: fontkit shapes it in that
// order, then whole clusters are reversed into visual order so marks stay after their base letter.
// A cluster is a glyph and the zero-width glyphs after it, such as Hebrew points. The mark itself
// never reaches a page.
export const rtlMark = '\ufdd0';

interface Collection {
  fonts: Font[];
}
export const isCollection = (value: unknown): value is Collection =>
  Array.isArray((value as Partial<Collection>).fonts);

type Layout = (
  text: string,
  features?: unknown,
  script?: string,
  language?: string,
  direction?: string,
) => GlyphRun;

function layOutRightToLeft(font: Font) {
  const layout = font.layout.bind(font) as Layout;
  (font as { layout: Layout }).layout = (text, features, ...rest) => {
    if (typeof text !== 'string' || !text.startsWith(rtlMark))
      return layout(text, features, ...rest);
    const run = layout(text.slice(rtlMark.length), features, undefined, undefined, 'ltr');
    const clusters: number[][] = [];
    run.glyphs.forEach((glyph, index) => {
      // Glyphs a font splits from a letter map to a zero-width joiner in the PDF's text map.
      // Readers drop it, where an empty entry would extract as a control character.
      if (!glyph.codePoints.length) glyph.codePoints = [0x200d];
      const mark = (glyph as Glyph & { isMark?: boolean }).isMark || !run.positions[index].xAdvance;
      if (clusters.length && mark) clusters.at(-1)!.push(index);
      else clusters.push([index]);
    });
    const order = clusters.reverse().flat();
    run.glyphs = order.map((index) => run.glyphs[index]);
    run.positions = order.map((index) => run.positions[index]);
    return run;
  };
}

// The subset classes of the fontkit build that pdf-lib uses. Only the parts repaired below.
interface CffSubset {
  cff: {
    topDict: { FDArray: Record<string, unknown>[] };
    fdForGlyph(glyph: number): number | null;
  };
  glyphs: number[];
  font: { getGlyph(id: number): { path: unknown; _usedSubrs?: Record<string, boolean> } };
  subsetSubrs(subrs: unknown, used: Record<string, boolean>): unknown;
  subsetFontdict(topDict: Record<string, unknown>): void;
  encodeStream(): Stream;
}
interface TrueTypeSubset {
  glyf: Uint8Array[];
  offset: number;
  _addGlyph(glyph: number): number;
}
interface Stream {
  on(event: string, listener: (value?: never) => void): Stream;
}

// Keeps each glyph with the font dictionary it was drawn with. fontkit 1.x assigns every glyph to
// the most recently added dictionary, which garbles CID-keyed CJK fonts such as Noto Sans CJK.
function subsetFontdict(this: CffSubset, topDict: Record<string, unknown>) {
  const dictionaries: Record<string, unknown>[] = [];
  const fds: number[] = [];
  const used: Record<string, boolean>[] = [];
  const index = new Map<number, number>();
  for (const id of this.glyphs) {
    const fd = this.cff.fdForGlyph(id);
    if (fd === null) continue;
    if (!index.has(fd)) {
      index.set(fd, dictionaries.length);
      dictionaries.push({ ...this.cff.topDict.FDArray[fd] });
      used.push({});
    }
    fds.push(index.get(fd)!);
    const glyph = this.font.getGlyph(id);
    void glyph.path; // Parsing the outline records the subroutines it calls.
    for (const subr in glyph._usedSubrs) used[index.get(fd)!][subr] = true;
  }
  dictionaries.forEach((dictionary, position) => {
    delete dictionary.FontName;
    const privateDict = dictionary.Private as { Subrs?: unknown } | undefined;
    if (privateDict?.Subrs)
      dictionary.Private = {
        ...privateDict,
        Subrs: this.subsetSubrs(privateDict.Subrs, used[position]),
      };
  });
  topDict.FDArray = dictionaries;
  topDict.FDSelect = { version: 0, fds };
}

// fontkit 1.x writes the length of the source table into the one-byte CFF header offset size.
// Readers such as FreeType then reject the font, so the header gets the valid size 4.
function repairCffHeader(subset: CffSubset) {
  const encode = subset.encodeStream.bind(subset);
  subset.encodeStream = () => {
    const listeners = new Map<string, ((value?: never) => void)[]>();
    const stream: Stream = {
      on(event, listener) {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
        return stream;
      },
    };
    const parts: Uint8Array[] = [];
    const emit = (event: string, value?: unknown) =>
      listeners.get(event)?.forEach((listener) => listener(value as never));
    encode()
      .on('data', (part?: Uint8Array) => parts.push(part!))
      .on('error', (error?: Error) => emit('error', error))
      .on('end', () => {
        const bytes = Buffer.concat(parts);
        if (bytes.length > 3) bytes[3] = 4;
        emit('data', bytes);
        emit('end');
      });
    return stream;
  };
}

// Short loca offsets count in two-byte units, so every TrueType glyph must have an even length.
function padGlyphs(subset: TrueTypeSubset) {
  const addGlyph = subset._addGlyph.bind(subset);
  subset._addGlyph = (glyph) => {
    const position = addGlyph(glyph);
    const data = subset.glyf[position];
    if (data.length % 2) {
      // fontkit's encoder accepts only its own Buffer class, so the copy is made with it.
      const padded = (data.constructor as unknown as { alloc(size: number): Uint8Array }).alloc(
        data.length + 1,
      );
      padded.set(data);
      subset.glyf[position] = padded;
      subset.offset += 1;
    }
    return position;
  };
}

function repairSubsets(font: Font) {
  const createSubset = font.createSubset.bind(font);
  font.createSubset = () => {
    const subset = createSubset() as unknown as Partial<CffSubset & TrueTypeSubset>;
    if (subset.cff) {
      (subset as CffSubset).subsetFontdict = subsetFontdict;
      repairCffHeader(subset as CffSubset);
    } else padGlyphs(subset as TrueTypeSubset);
    return subset as never;
  };
}

/**
 * A fontkit for one PDF document. Fonts are opened ahead of embedding, so a face of a TrueType
 * collection can be chosen and fallback fonts can be repaired. pdf-lib receives the same byte
 * array and gets the prepared font back.
 */
export function documentFontkit() {
  const prepared = new Map<Uint8Array, Font>();
  return {
    fontkit: {
      create: (bytes: Uint8Array) => prepared.get(bytes) ?? fontkit.create(bytes),
    },
    // `repair` stays off for Liberation Sans so documents without fallback text keep their bytes.
    prepare(bytes: Uint8Array, face: string | undefined, repair: boolean) {
      const key = bytes.subarray(0);
      const font = fontkit.create(bytes, face);
      layOutRightToLeft(font);
      if (repair) repairSubsets(font);
      prepared.set(key, font);
      return { key, font };
    },
  };
}
