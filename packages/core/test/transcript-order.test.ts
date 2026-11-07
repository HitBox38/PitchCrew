import { expect, it } from 'vitest';
import {
  transcriptOrder,
  type TranscriptMessagePosition,
  type TranscriptRunPosition,
} from '../src/transcript-order.ts';

const at = (second: number) => new Date(Date.UTC(2026, 10, 6, 12, 0, second)).toISOString();
const message = (
  id: string,
  second: number,
  sender = 'user',
  runId: string | null = null,
): TranscriptMessagePosition => ({ id, createdAt: at(second), sender, runId });
const run = (
  id: string,
  second: number,
  requestId?: string,
  status = 'completed',
  roleId = 'scout',
): TranscriptRunPosition => ({ id, roleId, startedAt: at(second), requestId, status });
const requests = [
  { id: 'request-a', messageId: 'm1', deliveries: [{ runId: 'a' }] },
  { id: 'request-b', messageId: 'm2', deliveries: [{ runId: 'b' }] },
];
const messages = [message('m1', 0), message('m2', 2), message('r1', 5, 'scout', 'a')];

it.each(['running', 'waiting', 'completed', 'failed', 'cancelled'])(
  'places a delivered queued input after the previous answer for a %s turn',
  (status) => {
    const source = [...messages, message('r2', 9, 'scout', 'b')];
    const result = transcriptOrder(
      source,
      [run('a', 0, 'request-a'), run('b', 6, 'request-b', status)],
      { requests },
    );
    expect(result.map((item) => item.id)).toEqual(['m1', 'turn-a', 'r1', 'm2', 'turn-b', 'r2']);
    expect(result.find((item) => item.id === 'm2')?.createdAt).toBe(at(6));
    expect(source[1].createdAt).toBe(at(2));
  },
);

it('keeps the previous answer first when dispatch shares its exact millisecond', () => {
  const result = transcriptOrder(
    messages,
    [run('a', 0, 'request-a'), run('b', 5, 'request-b', 'running')],
    { requests },
  );
  expect(result.map((item) => item.id)).toEqual(['m1', 'turn-a', 'r1', 'm2', 'turn-b']);
});

it('shows a group input once above its earliest recipient while preserving settled reply pairs', () => {
  const group = [{ ...requests[1], deliveries: [{ runId: 'b' }, { runId: 'c' }] }];
  const runs = [
    run('a', 0),
    run('c', 8, 'request-b', 'completed', 'coach'),
    run('b', 6, 'request-b'),
  ];
  const result = transcriptOrder(
    [...messages, message('r2', 9, 'coach', 'c'), message('r3', 10, 'scout', 'b')],
    runs,
    { requests: group },
  );
  expect(result.map((item) => item.id)).toEqual([
    'm1',
    'turn-a',
    'r1',
    'm2',
    'turn-c',
    'r2',
    'turn-b',
    'r3',
  ]);
  expect(result.filter((item) => item.id === 'm2')).toHaveLength(1);
  expect(result.find((item) => item.id === 'm2')?.createdAt).toBe(at(6));
});

it('retains first dispatch after retry replaces delivery pointers, including invisible successful runs', () => {
  const first = run('first', 6, 'request-b');
  const retry = run('retry', 10, 'request-b', 'failed');
  const result = transcriptOrder(messages, [run('a', 0), retry], {
    requests: [{ ...requests[1], deliveries: [{ runId: 'retry' }] }],
    dispatchRuns: [run('a', 0), first, retry],
  });
  expect(result.map((item) => item.id)).toEqual(['m1', 'turn-a', 'r1', 'm2', 'turn-retry']);
  expect(result.find((item) => item.id === 'm2')?.createdAt).toBe(at(6));
});

it('supports legacy delivery pointers without requestId and preserves unknown admission times', () => {
  const result = transcriptOrder(messages, [run('a', 0), run('b', 6, undefined, 'running')], {
    requests,
  });
  expect(result.find((item) => item.id === 'm2')?.createdAt).toBe(at(6));
  expect(transcriptOrder(messages, [run('a', 0)])[1]).toMatchObject({ id: 'm2', createdAt: at(2) });
});

it('keeps an authoritative server dispatch position when only a later retry remains loaded', () => {
  const result = transcriptOrder(
    [{ ...messages[1], positionedAt: at(6) }],
    [run('b', 10, 'request-b', 'running')],
    { requests },
  );
  expect(result[0]).toMatchObject({ id: 'm2', createdAt: at(6) });
});

it('retains exact-millisecond server ordering when request metadata is outside the page', () => {
  const result = transcriptOrder(
    messages.map((item) => (item.id === 'm2' ? { ...item, positionedAt: at(5) } : item)),
    [run('a', 0), run('b', 5, undefined, 'running')],
  );
  expect(result.map((item) => item.id)).toEqual(['m1', 'turn-a', 'r1', 'm2', 'turn-b']);
});

it('folds only an exact redundant stopped note and never treats system outcomes as triggers or answers', () => {
  const note = { ...message('note', 7, 'system', 'b'), content: 'Run cancelled.' };
  const other = { ...message('other', 8, 'system', 'a'), content: 'Useful diagnostic.' };
  const result = transcriptOrder(
    [...messages, note, other],
    [run('a', 0), run('b', 6, undefined, 'cancelled')],
  );
  expect(result.map((item) => item.id)).toEqual(['m1', 'm2', 'turn-a', 'r1', 'turn-b', 'other']);
  expect(transcriptOrder([note], []).map((item) => item.id)).toEqual(['note']);
  expect(
    transcriptOrder([note], [run('b', 6, undefined, 'failed')]).map((item) => item.id),
  ).toEqual(['turn-b', 'note']);
});
