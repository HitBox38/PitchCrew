import bidiFactory from 'bidi-js';

// The Unicode Bidirectional Algorithm (UAX #9) from bidi-js. Levels are resolved per paragraph in
// logical order; lines are wrapped in logical order and then reordered for display.
const bidi = bidiFactory();

export type Direction = 'ltr' | 'rtl';

// Rules P2 and P3: the first strong character decides a paragraph's direction.
export function baseDirection(text: string): Direction {
  for (const character of text) {
    const type = bidi.getBidiCharTypeName(character);
    if (type === 'L') return 'ltr';
    if (type === 'R' || type === 'AL') return 'rtl';
  }
  return 'ltr';
}

/** Embedding levels per UTF-16 code unit; odd levels are right-to-left. */
export const embeddingLevels = (text: string, direction: Direction) =>
  bidi.getEmbeddingLevels(text, direction).levels;

/** Rule L4: brackets and similar characters swap at right-to-left levels. */
export const mirrored = (character: string) => bidi.getMirroredCharacter(character) ?? character;

/**
 * Rule L2: from the highest level down to the lowest odd level, reverses every run of items at
 * that level or higher. Items keep their own text in logical order; the PDF writer lays out odd
 * levels right to left.
 */
export function visualOrder<T>(items: T[], level: (item: T) => number): T[] {
  const levels = items.map(level);
  const odd = levels.filter((value) => value % 2);
  if (!odd.length) return items;
  const lowest = Math.min(...odd);
  const order = items.map((_, index) => index);
  for (let current = Math.max(...levels); current >= lowest; current--)
    for (let start = 0; start < order.length;) {
      if (levels[order[start]] < current) {
        start++;
        continue;
      }
      let end = start;
      while (end < order.length && levels[order[end]] >= current) end++;
      order.splice(start, end - start, ...order.slice(start, end).reverse());
      start = end;
    }
  return order.map((index) => items[index]);
}
