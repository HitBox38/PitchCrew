import type { DiffKind, DiffLine, DiffSegment } from './types.ts';

/** Above this many comparisons, show a plain replacement instead of a longest-common-subsequence diff. */
const maxCells = 2_000_000;

/** Longest common subsequence diff of two token lists, in order. */
export function diffSequence(before: string[], after: string[]): DiffSegment[] {
  const rows = before.length;
  const columns = after.length;
  if (rows * columns > maxCells)
    return [
      ...before.map((text) => ({ kind: 'removed' as const, text })),
      ...after.map((text) => ({ kind: 'added' as const, text })),
    ];
  // lengths[i][j] is the common length of before[i..] and after[j..].
  const lengths = Array.from({ length: rows + 1 }, () => new Uint32Array(columns + 1));
  for (let i = rows - 1; i >= 0; i--)
    for (let j = columns - 1; j >= 0; j--)
      lengths[i][j] =
        before[i] === after[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  const result: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < rows || j < columns) {
    if (i < rows && j < columns && before[i] === after[j]) {
      result.push({ kind: 'same', text: before[i] });
      i++;
      j++;
    } else if (i < rows && (j === columns || lengths[i + 1][j] >= lengths[i][j + 1])) {
      // Removals come before additions within each changed block.
      result.push({ kind: 'removed', text: before[i++] });
    } else {
      result.push({ kind: 'added', text: after[j++] });
    }
  }
  return result;
}

/** Joins neighboring segments of the same kind. */
function merge(segments: DiffSegment[]): DiffSegment[] {
  return segments.reduce<DiffSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (previous?.kind === segment.kind) previous.text += segment.text;
    else merged.push({ ...segment });
    return merged;
  }, []);
}

/** Word-level changes inside one paragraph, as the removed and added sides. */
export function diffWords(
  before: string,
  after: string,
): Record<'removed' | 'added', DiffSegment[]> {
  const words = diffSequence(before.split(/(\s+)/), after.split(/(\s+)/));
  return {
    removed: merge(words.filter((word) => word.kind !== 'added')),
    added: merge(words.filter((word) => word.kind !== 'removed')),
  };
}

/** Similar enough that word highlights help instead of hiding a rewrite. */
function related(segments: DiffSegment[], text: string) {
  const same = segments.filter((segment) => segment.kind === 'same').map((s) => s.text);
  return same.join('').trim().length >= text.trim().length * 0.4;
}

/** Paragraphs separated by blank lines; single line breaks stay inside a paragraph. */
export function paragraphs(text: string): string[] {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\n\s*\n/) : [];
}

/**
 * Paragraph diff of two instruction texts. A removed paragraph followed by an added one in the
 * same changed block is compared word by word when the two are similar.
 */
export function diffInstructions(before: string, after: string): DiffLine[] {
  const lines: DiffLine[] = diffSequence(paragraphs(before), paragraphs(after));
  for (let start = 0; start < lines.length; start++) {
    if (lines[start].kind !== 'removed') continue;
    let end = start;
    while (lines[end + 1]?.kind === 'removed') end++;
    let added = end + 1;
    for (let offset = 0; offset <= end - start; offset++, added++) {
      const removed = lines[start + offset];
      const addition = lines[added];
      if (addition?.kind !== 'added') break;
      const words = diffWords(removed.text, addition.text);
      if (!related(words.added, addition.text)) continue;
      removed.segments = words.removed;
      addition.segments = words.added;
    }
    start = end;
  }
  return lines;
}

export function diffCounts(lines: DiffLine[]): Record<DiffKind, number> {
  const counts: Record<DiffKind, number> = { same: 0, added: 0, removed: 0 };
  for (const line of lines) if (line.text.trim()) counts[line.kind]++;
  return counts;
}
