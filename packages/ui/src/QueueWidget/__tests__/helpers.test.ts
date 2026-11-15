import { expect, it } from 'vitest';
import type { WorkspaceQueue, WorkQueueView } from '@pitchcrew/core';
import { queueTone } from '@/lib/work-queue.ts';
import { queueAttention, queueTrayLabel, queueCountLabel, queueUtilization } from '../helpers.ts';

const view = (state: WorkQueueView['state'], pauseKind?: WorkQueueView['pauseKind']) =>
  ({ state, paused: state === 'paused', pauseKind }) as WorkQueueView;
const workspace = (queues: WorkQueueView[], active = 2, concurrency = 5): WorkspaceQueue => ({
  active,
  concurrency,
  background: 0,
  queues,
});

it('says held and failed work in words beside the slot count', () => {
  expect(queueTrayLabel(workspace([view('running'), view('running')]))).toBe('2 of 5 working');
  expect(
    queueTrayLabel(
      workspace([view('running'), view('waiting'), view('paused', 'failed'), view('blocked')]),
    ),
  ).toBe('2 of 5 working · 2 on hold · 1 failed');
});

it('summarizes occupancy without allocating an item per slot', () => {
  expect(queueUtilization({ active: 3, concurrency: 10 })).toBe(30);
  expect(queueUtilization({ active: 250_000, concurrency: 1_000_000 })).toBe(25);
  expect(queueUtilization({ active: 0, concurrency: Number.MAX_SAFE_INTEGER })).toBe(0);
  expect(queueCountLabel(10)).toBe('10');
  expect(queueCountLabel(1_500)).toBe('1.5K');
  expect(queueCountLabel(1_000_000)).toBe('1M');
});

it('saturates the meter while retaining exact counts above a reduced limit', () => {
  expect(queueUtilization({ active: 7, concurrency: 3 })).toBe(100);
  expect(queueTrayLabel(workspace([], 7, 3))).toBe('7 of 3 working');
});

it('reports failed work separately from queues on hold', () => {
  expect(
    queueAttention(
      workspace([
        view('running'),
        view('ready'),
        view('waiting'),
        view('paused', 'user'),
        view('paused', 'interrupted'),
        view('paused', 'failed'),
        view('blocked'),
      ]),
    ),
  ).toEqual({ onHold: 4, failed: 1 });
});

it('shows the same bead as the Queue page: only failed work is rose', () => {
  expect(queueTone(view('running'))).toBe('plum');
  expect(queueTone(view('waiting'))).toBe('ochre');
  expect(queueTone(view('blocked'))).toBe('ochre');
  expect(queueTone(view('paused', 'interrupted'))).toBe('ochre');
  expect(queueTone(view('paused', 'failed'))).toBe('rose');
  expect(queueTone(view('paused', 'user'))).toBeUndefined();
  expect(queueTone(view('ready'))).toBeUndefined();
});
