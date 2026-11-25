import { describe, expect, it } from 'vitest';
import { restEnd, type RailLine } from '../hooks/useRailEnd.ts';

const line = (top: number, height: number, head = false): RailLine => ({
  top,
  bottom: top + height,
  head,
});

/** The pinned rail's lines from its top: Working now, Up next, the crew line, then Pipeline. */
const rail = [
  line(0, 28, true),
  ...[36, 92, 148, 204, 260].map((top) => line(top, 48)),
  line(332, 28, true),
  ...[368, 412, 456].map((top) => line(top, 36)),
  line(500, 40),
  line(560, 28, true),
  ...[596, 636, 676].map((top) => line(top, 32)),
];

describe('The rail’s resting view', () => {
  it('ends between whole rows, giving up only the row it would cut', () => {
    // Already between rows: the rail keeps its whole room.
    expect(restEnd(rail, 545)).toBeUndefined();
    // Through Halcyon's run: the view ends on the run above it.
    expect(restEnd(rail, 120)).toBe(84);
  });

  it('never ends on a block heading without its first row', () => {
    // Through the first stage row: never right under "Pipeline 114 open", but on the crew line.
    expect(restEnd(rail, 610)).toBe(540);
    // Between the heading and its first row, the view would show the heading alone.
    expect(restEnd(rail, 592)).toBe(540);
    // Below that row the heading keeps it, and only the row the view cuts goes.
    expect(restEnd(rail, 650)).toBe(628);
  });

  it('keeps its whole room rather than give up more than it may', () => {
    const tall = [line(0, 28, true), line(36, 300)];
    expect(restEnd(tall, 250)).toBeUndefined();
  });
});
