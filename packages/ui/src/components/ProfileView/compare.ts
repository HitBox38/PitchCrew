import { diffSequence } from '@/components/InstructionUpdate/helpers.ts';
import { myersDiff } from './myers.ts';

/** One row of a line diff: a numbered line, or a run of unchanged lines folded away. */
export type CompareRow =
  | { kind: 'same' | 'removed' | 'added'; text: string; before?: number; after?: number }
  | { kind: 'skip'; count: number };

const context = 3;
const lines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');

/** Myers' shortest edit script; for a huge rewrite, the bounded LCS (which may list it all). */
const diff = (before: string[], after: string[]) =>
  myersDiff(before, after) ?? diffSequence(before, after);

/** Unchanged lines at both ends stay "same"; only the changed middle is diffed. */
const lineDiff = (before: string[], after: string[]) => {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  const same = (text: string) => ({ kind: 'same' as const, text });
  return [
    ...before.slice(0, start).map(same),
    ...diff(before.slice(start, before.length - end), after.slice(start, after.length - end)),
    ...before.slice(before.length - end).map(same),
  ];
};

/**
 * The saved copy against the draft, line by line like a code editor's diff: both line numbers,
 * blank lines included, and unchanged runs folded to three lines around each change.
 */
export const compareRows = (saved: string, draft: string): CompareRow[] => {
  let before = 0;
  let after = 0;
  const numbered = lineDiff(lines(saved), lines(draft)).map((line) => ({
    kind: line.kind,
    text: line.text,
    before: line.kind === 'added' ? undefined : ++before,
    after: line.kind === 'removed' ? undefined : ++after,
  }));
  const near = numbered.map(() => false);
  numbered.forEach((row, index) => {
    if (row.kind === 'same') return;
    const last = Math.min(numbered.length - 1, index + context);
    for (let k = Math.max(0, index - context); k <= last; k++) near[k] = true;
  });
  const rows: CompareRow[] = [];
  for (let index = 0; index < numbered.length;) {
    if (near[index]) {
      rows.push(numbered[index++]);
      continue;
    }
    let end = index;
    while (end < numbered.length && !near[end]) end++;
    if (end - index === 1) rows.push(numbered[index]);
    else rows.push({ kind: 'skip', count: end - index });
    index = end;
  }
  return rows;
};

/** How many lines the draft adds and removes. */
export const compareCounts = (rows: CompareRow[]) => ({
  added: rows.filter((row) => row.kind === 'added').length,
  removed: rows.filter((row) => row.kind === 'removed').length,
});
