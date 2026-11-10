import { expect, it } from 'vitest';
import type { ChatMessage, Run, Snapshot } from '@pitchcrew/core';
import { sameEntry, type TranscriptEntryProps } from '../transcript-entry.ts';
import { shareEqual } from '@/lib/share-equal.ts';

const message: ChatMessage = {
  id: 'm1',
  threadId: 'scout',
  from: 'user',
  to: 'scout',
  content: 'Fictional question',
  cardId: null,
  runId: null,
  createdAt: '2026-11-10T10:00:00.000Z',
};
const run = { id: 'r1', roleId: 'scout', status: 'running', activity: [] } as unknown as Run;
const data = {
  cards: [],
  conversations: [],
  roles: [{ id: 'scout', name: 'Scout' }],
  chatRequests: [{ id: 'q1', messageId: 'm1', deliveries: [] }],
  runs: [run],
} as unknown as Snapshot;
// The transcript passes stable handlers (useStableHandlers).
const handlers = { onOpenCard: () => {}, answerQuestion: () => {} };
const props = (overrides: Partial<TranscriptEntryProps> = {}): TranscriptEntryProps => ({
  item: { kind: 'message', id: 'm1', createdAt: message.createdAt, message },
  anchor: false,
  day: false,
  continued: false,
  replying: false,
  data,
  streamingIds: new Set(),
  reduced: false,
  name: (id) => id,
  thread: 'scout',
  ...handlers,
  ...overrides,
});

it('skips an entry whose message, request and snapshot parts are unchanged', () => {
  const base = props();
  // A stream update with an unrelated change: the shared data keeps everything else.
  const next = shareEqual(data, { ...JSON.parse(JSON.stringify(data)), runs: [] }) as Snapshot;
  expect(sameEntry(base, { ...base, data: next, name: (id) => id })).toBe(true);
  expect(sameEntry(base, { ...base, streamingIds: new Set(['m1']) })).toBe(false);
  const request = { ...data, chatRequests: [{ id: 'q1', messageId: 'm1', deliveries: [{}] }] };
  expect(sameEntry(base, { ...base, data: request as unknown as Snapshot })).toBe(false);
  const roles = { ...data, roles: [{ id: 'scout', name: 'Renamed' }] };
  expect(sameEntry(base, { ...base, data: roles as unknown as Snapshot })).toBe(false);
});

it('renders a changed turn and every question again', () => {
  const turn = props({ item: { kind: 'turn', id: 'turn-r1', createdAt: '', run } });
  expect(
    sameEntry(
      turn,
      props({ item: { kind: 'turn', id: 'turn-r1', createdAt: '', run: { ...run } } }),
    ),
  ).toBe(true);
  expect(
    sameEntry(
      turn,
      props({
        item: { kind: 'turn', id: 'turn-r1', createdAt: '', run: { ...run, status: 'completed' } },
      }),
    ),
  ).toBe(false);
  const question = { ...message, userInput: { id: 'u1', kind: 'question' as const } };
  const asking = props({ item: { kind: 'message', id: 'm1', createdAt: '', message: question } });
  expect(sameEntry(asking, asking)).toBe(false);
});
