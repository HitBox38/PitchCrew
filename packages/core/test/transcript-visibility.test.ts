import { afterEach, expect, it, vi } from 'vitest';
import {
  hiddenTranscriptMessageIds,
  type TranscriptVisibilityMessage,
  type TranscriptVisibilityTask,
} from '../src/transcript-visibility.ts';

const referencesKey = JSON.stringify([
  { kind: 'agent', id: 'coach', label: 'Coach', token: '@coach', start: 0, end: 6 },
]);
const source: TranscriptVisibilityMessage = {
  id: 'canonical',
  threadId: 'group',
  sender: 'scout',
  recipient: 'user',
  runId: 'run',
  content: '@coach Exact reply',
  createdAt: '2026-11-06T12:00:00.001Z',
  referencesKey,
  hasAttachments: false,
  hasUserInput: false,
  hasNotification: false,
};
const forward: TranscriptVisibilityMessage = {
  ...source,
  id: 'forward',
  recipient: 'coach',
  createdAt: '2026-11-06T12:00:00.002Z',
};
const task: TranscriptVisibilityTask = {
  parentRunId: 'run',
  threadId: 'group',
  roleId: 'coach',
  trigger: 'message',
  content: source.content,
};
afterEach(() => vi.restoreAllMocks());

it('requires exact canonical and task proof while preserving intentional repeats and independently sent messages', () => {
  const preserved: TranscriptVisibilityMessage[] = [
    { ...forward, id: 'later-run', runId: 'later' },
    { ...forward, id: 'other-thread', threadId: 'dm' },
    { ...forward, id: 'other-author', sender: 'writer' },
    { ...forward, id: 'different-instruction', content: 'Separate request' },
    { ...forward, id: 'different-references', referencesKey: '[]' },
    { ...forward, id: 'earlier', createdAt: '2026-11-06T12:00:00.000Z' },
    { ...forward, id: 'file', hasAttachments: true },
    { ...forward, id: 'question', hasUserInput: true },
    { ...forward, id: 'notification', hasNotification: true },
    { ...source, id: 'repeated-broadcast' },
  ];
  const messages = [source, forward, ...preserved];
  expect([...hiddenTranscriptMessageIds(messages, [task], [])]).toEqual(['forward']);
  expect(hiddenTranscriptMessageIds(messages, [], []).size).toBe(0);
  expect(hiddenTranscriptMessageIds(messages, [{ ...task, trigger: 'invoke' }], []).size).toBe(0);
  expect(
    hiddenTranscriptMessageIds(
      [
        { ...source, referencesKey: '[]' },
        { ...forward, referencesKey: '[]' },
      ],
      [task],
      [],
    ).size,
  ).toBe(0);
  expect(messages).toHaveLength(12);
});

it('only excludes never-started recoverable requests, including mixed group deliveries', () => {
  const cases = [
    { messageId: 'paused', deliveries: [{ runId: null, status: 'paused' }] },
    {
      messageId: 'mixed-pending',
      deliveries: [
        { runId: null, status: 'queued' },
        { runId: null, status: 'failed' },
      ],
    },
    {
      messageId: 'partial',
      deliveries: [
        { runId: 'started', status: 'completed' },
        { runId: null, status: 'paused' },
      ],
    },
    { messageId: 'cancelled', deliveries: [{ runId: null, status: 'cancelled' }] },
    { messageId: 'empty', deliveries: [] },
  ];
  const messages = cases.map((request) => ({ ...source, id: request.messageId, sender: 'user' }));
  expect([...hiddenTranscriptMessageIds(messages, [], cases)]).toEqual(['paused', 'mixed-pending']);
});

it('retains a delivered request while resume resets its current delivery to queued', () => {
  const request = {
    id: 'resumed',
    messageId: 'user',
    deliveries: [{ runId: null, status: 'queued' }],
  };
  const message = { ...source, id: 'user', sender: 'user' };
  expect([...hiddenTranscriptMessageIds([message], [], [request])]).toEqual(['user']);
  expect(hiddenTranscriptMessageIds([message], [], [request], new Set(['resumed'])).size).toBe(0);
});

it('indexes repeated content within one run once and retains the earliest matching canonical timestamp', () => {
  const messages = Array.from({ length: 800 }, (_, i) => [
    {
      ...source,
      id: `source-${i}`,
      createdAt: i === 0 ? source.createdAt : '2026-11-06T12:00:01.000Z',
    },
    { ...forward, id: `forward-${i}` },
  ]).flat();
  const parse = vi.spyOn(JSON, 'parse');
  expect(hiddenTranscriptMessageIds(messages, Array(800).fill(task), []).size).toBe(800);
  expect(parse).toHaveBeenCalledTimes(1);
});

it('keeps rows with malformed historical reference metadata instead of hiding them or breaking history', () => {
  expect(
    hiddenTranscriptMessageIds(
      [
        { ...source, referencesKey: 'bad' },
        { ...forward, referencesKey: 'bad' },
      ],
      [task],
      [],
    ).size,
  ).toBe(0);
});
