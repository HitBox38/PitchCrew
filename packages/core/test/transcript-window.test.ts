import { expect, it } from 'vitest';
import { transcriptWindow, type TranscriptPosition } from '../src/transcript-order.ts';

const joined = (previous: TranscriptPosition, current: TranscriptPosition) =>
  previous.kind === 'turn' && current.kind === 'message' && previous.runId === current.runId;
const fixtures = (length: number): TranscriptPosition[] =>
  Array.from({ length }, (_, index) => {
    const user: TranscriptPosition = {
      id: `m${index}`,
      kind: 'message',
      runId: null,
      createdAt: '',
    };
    const turn: TranscriptPosition = {
      id: `turn${index}`,
      kind: 'turn',
      runId: String(index),
      createdAt: '',
    };
    const reply: TranscriptPosition = { ...turn, id: `reply${index}`, kind: 'message' };
    return [...(index % 4 === 0 ? [] : [user]), turn, reply];
  }).flat();

it('never skips input rows when an older anchor needs preceding settled-turn context', () => {
  const items: TranscriptPosition[] = Array.from({ length: 55 }, (_, index) => [
    { id: `m${index}`, kind: 'message' as const, runId: null, createdAt: '' },
    { id: `turn${index}`, kind: 'turn' as const, runId: String(index), createdAt: '' },
    { id: `r${index}`, kind: 'message' as const, runId: String(index), createdAt: '' },
  ]).flat();
  const page = transcriptWindow(items, 'r17', 50, joined);
  expect(page.items[0].id).toBe('turn17');
  expect(page.items.at(-1)?.id).toBe('m34');
  expect(page.items).toHaveLength(51);
});

it('keeps mixed pair boundaries reachable from every anchor with at most one extra context row', () => {
  for (let length = 1; length <= 100; length++) {
    const items = fixtures(length);
    for (const anchor of items) {
      const page = transcriptWindow(items, anchor.id, 50, joined);
      expect(page.items.some((item) => item.id === anchor.id)).toBe(true);
      expect(page.items.length).toBeLessThanOrEqual(51);
      expect(page.start === 0 || !joined(items[page.start - 1], items[page.start])).toBe(true);
      expect(page.end === items.length || !joined(items[page.end - 1], items[page.end])).toBe(true);
    }
    let page = transcriptWindow(items, items[0].id, 50, joined);
    const forward = [...page.items];
    while (page.newer) {
      const next = transcriptWindow(items, page.newer, 50, joined);
      expect(next.start).toBeGreaterThan(page.start);
      forward.push(...next.items);
      page = next;
    }
    expect(forward).toEqual(items);
    page = transcriptWindow(items, null, 50, joined);
    const backwards = new Set(page.items.map((item) => item.id));
    while (page.older) {
      const previous = transcriptWindow(items, page.older, 50, joined);
      expect(previous.start).toBeLessThan(page.start);
      previous.items.forEach((item) => backwards.add(item.id));
      page = previous;
    }
    expect(backwards).toEqual(new Set(items.map((item) => item.id)));
  }
});
