import { expect, it } from 'vitest';
import { queueTone } from '@/lib/work-queue.ts';
import { backgroundLine, queueRequestHeading, slotFact } from '../helpers.ts';

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
