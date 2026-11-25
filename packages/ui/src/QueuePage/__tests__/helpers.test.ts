import { expect, it } from 'vitest';
import { queueTone } from '@/lib/work-queue.ts';
import {
  backgroundLine,
  queueMove,
  queueMoves,
  queueRequestHeading,
  slotFact,
} from '../helpers.ts';

it('colours a queue bead by who must act next', () => {
  expect(queueTone({ state: 'running' })).toBe('plum');
  expect(queueTone({ state: 'waiting' })).toBe('ochre');
  expect(queueTone({ state: 'blocked' })).toBe('ochre');
  expect(queueTone({ state: 'paused', pauseKind: 'failed' })).toBe('rose');
  expect(queueTone({ state: 'paused', pauseKind: 'interrupted' })).toBe('ochre');
  expect(queueTone({ state: 'paused', pauseKind: 'user' })).toBeUndefined();
  expect(queueTone({ state: 'ready' })).toBeUndefined();
});

it('words slot, background and request counts', () => {
  expect(slotFact(2, 5)).toBe('2 of 5 slots');
  expect(slotFact(1, 1)).toBe('1 of 1 slot');
  expect(backgroundLine(1)).toBe('1 background routine is also running');
  expect(backgroundLine(2)).toBe('2 background routines are also running');
  const queue = { requests: [{}], tasks: [{}, {}] } as never;
  expect(queueRequestHeading(queue)).toBe('1 request · 2 crew follow-ups');
  expect(queueRequestHeading({ requests: [], tasks: [] } as never)).toBe('Add the next action');
});

it('moves a waiting item up, down or to the head of the whole line, never past the running head', () => {
  const line = ['running', 'a', 'b', 'c', 'd'].map((id) => ({ id }));
  const head = 1; // The running request stays first and is never a destination.
  const sent: (string | null)[] = [];
  const move = (beforeId: string | null) => () => void sent.push(beforeId);
  const first = queueMoves(line, 1, head, move);
  expect(first.up).toBeUndefined();
  expect(first.makeNext).toBeUndefined();
  first.down?.();
  const third = queueMoves(line, 3, head, move);
  third.up?.();
  third.down?.();
  third.makeNext?.();
  const last = queueMoves(line, 4, head, move);
  expect(last.down).toBeUndefined();
  last.up?.();
  // "Down" lands before the item after next; from the second-to-last row that is the line's end.
  expect(sent).toEqual(['c', 'b', null, 'a', 'c']);
  // Over a shown subset the next-to-last shown row would jump to the end of the whole line (in the
  // whole line it lands before "d"), and the last shown row would wrongly offer no move down.
  const shown = line.slice(0, 4);
  const subset: (string | null)[] = [];
  queueMoves(shown, 2, head, (beforeId) => () => void subset.push(beforeId)).down?.();
  expect(subset).toEqual([null]);
  expect(queueMoves(shown, 3, head, move).down).toBeUndefined();
});

it('saves a new place in the waiting line through the host action', async () => {
  const calls: unknown[][] = [];
  const save = queueMove(async (...args) => void calls.push(args));
  await save('job:card/1', 'conversation:t1');
  await save('job:card/1', null);
  expect(calls).toEqual([
    ['/queue/job%3Acard%2F1', 'PUT', { action: 'move', beforeId: 'conversation:t1' }],
    ['/queue/job%3Acard%2F1', 'PUT', { action: 'move', beforeId: null }],
  ]);
});
