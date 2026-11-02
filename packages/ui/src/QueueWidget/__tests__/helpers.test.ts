import { expect, it } from 'vitest';
import type { WorkspaceQueue, WorkQueueView } from '@pitchcrew/core';
import { queueAttention, queueBeadTone, queueTrayLabel, traySockets } from '../helpers.ts';

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
  ).toBe('2 of 5 working · 1 on hold · 2 failed');
});

it('draws every configured slot with occupied slots first', () => {
  expect(traySockets({ active: 3, background: 1, concurrency: 5 })).toEqual([
    'working',
    'working',
    'background',
    'free',
    'free',
  ]);
  expect(traySockets({ active: 2, background: 0, concurrency: 10 })).toEqual([
    'working',
    'working',
    ...Array(8).fill('free'),
  ]);
  expect(traySockets({ active: 0, background: 0, concurrency: 50 })).toEqual(
    Array(50).fill('free'),
  );
  expect(traySockets({ active: 0, background: 0, concurrency: 2 })).toEqual(['free', 'free']);
  expect(traySockets({ active: 1, background: 0, concurrency: 1 })).toEqual(['working']);
});

it('keeps occupied slots visible while existing work finishes above a reduced limit', () => {
  expect(traySockets({ active: 7, background: 2, concurrency: 3 })).toEqual([
    ...Array(5).fill('working'),
    'background',
    'background',
  ]);
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
        view('blocked'),
      ]),
    ),
  ).toEqual({ onHold: 2, failed: 2 });
});

it('colours queue beads by state, not by agent', () => {
  expect(queueBeadTone(view('running'))).toBe('plum');
  expect(queueBeadTone(view('waiting'))).toBe('ochre');
  expect(queueBeadTone(view('paused', 'interrupted'))).toBe('rose');
  expect(queueBeadTone(view('paused', 'user'))).toBeUndefined();
  expect(queueBeadTone(view('ready'))).toBeUndefined();
});
