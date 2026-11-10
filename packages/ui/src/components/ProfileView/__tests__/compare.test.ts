import { describe, expect, it } from 'vitest';
import { compareCounts, compareRows } from '../compare.ts';
import { myersDiff } from '../myers.ts';

describe('compareRows', () => {
  it('numbers both sides, keeps blank lines and folds distant unchanged runs', () => {
    const saved = ['# Skills', '', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'old', 'h'].join('\n');
    const draft = ['# Skills', '', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'new', '', 'h'].join('\r\n');
    const rows = compareRows(saved, draft);
    expect(rows[0]).toEqual({ kind: 'skip', count: 6 });
    expect(rows.slice(1, 4).map((row) => row.kind)).toEqual(['same', 'same', 'same']);
    expect(rows.find((row) => row.kind === 'removed')).toEqual({
      kind: 'removed',
      text: 'old',
      before: 10,
      after: undefined,
    });
    expect(rows.filter((row) => row.kind === 'added')).toEqual([
      { kind: 'added', text: 'new', before: undefined, after: 10 },
      { kind: 'added', text: '', before: undefined, after: 11 },
    ]);
    expect(rows.at(-1)).toEqual({ kind: 'same', text: 'h', before: 11, after: 12 });
    expect(compareCounts(rows)).toEqual({ added: 2, removed: 1 });
  });

  it('never folds a single unchanged line between changes', () => {
    const rows = compareRows('1\n2\n3\n4\n5\n6\n7\n8\n9', '0\n2\n3\n4\n5\n6\n7\n8\nX');
    expect(rows.some((row) => row.kind === 'skip')).toBe(false);
  });

  it('keeps a long note with one change to that change', () => {
    const saved = Array.from({ length: 1500 }, (_, index) => `Line ${index}`);
    const draft = saved.with(700, 'Changed line');
    const rows = compareRows(saved.join('\n'), draft.join('\n'));
    expect(compareCounts(rows)).toEqual({ added: 1, removed: 1 });
    expect(compareCounts(compareRows(saved.join('\n'), saved.join('\n')))).toEqual({
      added: 0,
      removed: 0,
    });
  });

  it('finds distant changes in a long note without listing everything', () => {
    const saved = Array.from({ length: 1500 }, (_, index) => `Line ${index}`);
    const draft = saved.with(0, 'First changed').with(1499, 'Last changed');
    expect(compareCounts(compareRows(saved.join('\n'), draft.join('\n')))).toEqual({
      added: 2,
      removed: 2,
    });
    const inserted = [...saved.slice(0, 700), 'New line', ...saved.slice(700, 1400)];
    expect(compareCounts(compareRows(saved.join('\n'), inserted.join('\n')))).toEqual({
      added: 1,
      removed: 100,
    });
  });

  it('reproduces both texts exactly from the diff', () => {
    const saved = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const draft = ['b', 'x', 'c', 'd', 'y', 'g', 'h'];
    const lines = myersDiff(saved, draft)!;
    expect(lines.filter((line) => line.kind !== 'added').map((line) => line.text)).toEqual(saved);
    expect(lines.filter((line) => line.kind !== 'removed').map((line) => line.text)).toEqual(draft);
    expect(lines.filter((line) => line.kind !== 'same')).toHaveLength(6);
  });
});
