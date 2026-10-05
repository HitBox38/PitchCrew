import type { Font } from '@pdf-lib/fontkit';
import type { PDFFont } from 'pdf-lib';
import { baseDirection, type Direction, embeddingLevels, mirrored, visualOrder } from './bidi.ts';
import { type FontChoice, type FontKey, isBidiControl } from './font-choice.ts';
import { rtlMark } from './fontkit.ts';
import { styleOf } from './fonts.ts';
import type { Run } from './types.ts';

/** Text in one font, link and bidi level, in logical order. */
export interface Piece {
  text: string;
  font: PDFFont;
  href?: string;
  level: number;
  width: number;
  space: boolean;
}
/** A word, a space, a hard break or a fill that pushes the rest of the line to the far edge. */
export interface Atom {
  kind: 'word' | 'space' | 'break' | 'fill';
  pieces: Piece[];
  width: number;
}
export interface Paragraph {
  atoms: Atom[];
  direction: Direction;
}
export interface Fonts {
  choice: FontChoice;
  embedded: Map<FontKey, PDFFont>;
  shaped: Map<PDFFont, Font>;
}

// Invisible formatting characters are removed and other spacing becomes a plain space, so the
// font check only rejects characters that would print.
export const cleanText = (text: string) =>
  text
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]|\p{Variation_Selector}/gu, '')
    .replace(/[\t\n\v\f\r\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/g, ' ');

// Chinese and Japanese text has no spaces, so a line may break next to any ideograph or kana,
// except before closing punctuation and small kana or after opening brackets.
const breaksAround =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff01-\uff60]/u;
const noBreakBefore =
  /[、。，．・：；？！ー〜」』）〕］｝〉》】ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ々ゝゞヽヾ!%),.:;?\]}]/u;
const noBreakAfter = /[「『（〔［｛〈《【([{]/u;
const canBreak = (before: string, after: string) =>
  (breaksAround.test(before) || breaksAround.test(after)) &&
  !noBreakBefore.test(after) &&
  !noBreakAfter.test(before);

export const measure = (piece: Omit<Piece, 'width'>, size: number) =>
  piece.font.widthOfTextAtSize(piece.level % 2 ? rtlMark + piece.text : piece.text, size);

const atomOf = (kind: Atom['kind'], pieces: Piece[], width?: number): Atom => ({
  kind,
  pieces,
  width: width ?? pieces.reduce((sum, piece) => sum + piece.width, 0),
});

/**
 * Splits runs into atoms. Each character gets the first font that has it, and each atom keeps its
 * pieces in logical order with their bidi levels. `direction` overrides the paragraph's own.
 */
export function paragraph(
  runs: Run[],
  size: number,
  fonts: Fonts,
  direction?: Direction,
): Paragraph {
  const texts = runs.map((run) =>
    run.kind === 'text' ? cleanText(run.text) : run.kind === 'fill' ? '\t' : '\u2028',
  );
  const visible = texts.filter((_, index) => runs[index].kind === 'text').join('');
  const base = direction ?? baseDirection(visible);
  const levels = embeddingLevels(texts.join(''), base);
  const atoms: Atom[] = [];
  let word: Omit<Piece, 'width'>[] = [];
  let before = '';
  const finish = () => {
    if (!word.length) return;
    const pieces = word.map((piece) => ({ ...piece, width: measure(piece, size) }));
    atoms.push(atomOf('word', pieces));
    word = [];
  };
  let offset = 0;
  runs.forEach((run, index) => {
    const text = texts[index];
    const start = offset;
    offset += text.length;
    if (run.kind !== 'text') {
      finish();
      atoms.push(atomOf(run.kind, [], run.kind === 'fill' ? size : 0));
      before = '';
      return;
    }
    const style = styleOf(run);
    const keys = fonts.choice.fonts(text, style);
    let position = start;
    let spaced = false;
    [...text].forEach((character, number) => {
      const level = levels[position];
      position += character.length;
      if (isBidiControl(character)) return;
      const font = fonts.embedded.get(keys[number])!;
      if (character === ' ') {
        // Consecutive spaces within a run count once.
        if (!spaced) {
          finish();
          const space = { text: ' ', font, href: run.href, level, space: true };
          atoms.push(atomOf('space', [{ ...space, width: measure(space, size) }]));
        }
        spaced = true;
        before = '';
        return;
      }
      spaced = false;
      if (word.length && before && canBreak(before, character)) finish();
      before = character;
      const swapped = level % 2 ? mirrored(character) : character;
      const shown =
        swapped !== character && fonts.choice.covers(keys[number], swapped.codePointAt(0)!)
          ? swapped
          : character;
      const last = word.at(-1);
      if (last && last.font === font && last.href === run.href && last.level === level)
        last.text += shown;
      else word.push({ text: shown, font, href: run.href, level, space: false });
    });
  });
  finish();
  return { atoms, direction: base };
}

// The first `count` characters of a word, and the rest, with their widths measured again.
function splitWord(word: Atom, count: number, size: number): [Atom, Atom] {
  const head: Piece[] = [];
  const tail: Piece[] = [];
  let left = count;
  for (const piece of word.pieces) {
    const characters = [...piece.text];
    const taken = Math.min(left, characters.length);
    left -= taken;
    for (const [target, text] of [
      [head, characters.slice(0, taken).join('')],
      [tail, characters.slice(taken).join('')],
    ] as const)
      if (text) target.push({ ...piece, text, width: measure({ ...piece, text }, size) });
  }
  return [atomOf('word', head), atomOf('word', tail)];
}

/** Greedy word wrapping in logical order; a word wider than the line is split between characters. */
export function wrap(atoms: Atom[], size: number, width: number): Atom[][] {
  const lines: Atom[][] = [];
  let line: Atom[] = [];
  let used = 0;
  let pending: Atom[] = [];
  const finish = () => {
    lines.push(line);
    line = [];
    used = 0;
    pending = [];
  };
  for (const atom of atoms) {
    if (atom.kind === 'break') finish();
    else if (atom.kind === 'space') {
      if (line.length) pending.push(atom);
    } else {
      const gap = pending.reduce((sum, space) => sum + space.width, 0);
      if (line.length && used + gap + atom.width > width) finish();
      let word = atom;
      let length = word.pieces.reduce((sum, piece) => sum + [...piece.text].length, 0);
      while (!line.length && word.width > width && length > 1) {
        let count = 1;
        while (count < length && splitWord(word, count + 1, size)[0].width <= width) count++;
        const [head, tail] = splitWord(word, count, size);
        lines.push([head]);
        word = tail;
        length -= count;
      }
      if (line.length) {
        line.push(...pending);
        used += gap;
      }
      line.push(word);
      used += word.width;
      pending = [];
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

export interface Chunk {
  pieces: Piece[];
  width: number;
  // Width of the fill after this chunk, if any.
  fill?: number;
}

/**
 * Splits a line at its fills and puts each part in visual order. Rule L1 first returns spaces at
 * the end of a part to the paragraph level, so they stay at the line's trailing edge.
 */
export function visualChunks(line: Atom[], direction: Direction): Chunk[] {
  const base = direction === 'rtl' ? 1 : 0;
  const chunks: Chunk[] = [{ pieces: [], width: 0 }];
  for (const atom of line) {
    const chunk = chunks.at(-1)!;
    if (atom.kind === 'fill') {
      chunk.fill = atom.width;
      chunks.push({ pieces: [], width: 0 });
    } else {
      chunk.pieces.push(...atom.pieces);
      chunk.width += atom.width;
    }
  }
  for (const chunk of chunks) {
    const pieces = chunk.pieces.map((piece) => ({ ...piece }));
    for (let index = pieces.length - 1; index >= 0 && pieces[index].space; index--)
      pieces[index].level = base;
    chunk.pieces = visualOrder(pieces, (piece) => piece.level);
  }
  return chunks;
}
