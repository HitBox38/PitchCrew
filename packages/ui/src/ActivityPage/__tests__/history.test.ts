import { expect, it } from 'vitest';
import type { BoardEvent, Snapshot } from '@pitchcrew/core';
import {
  activityContext,
  currentStatus,
  dayLabel,
  eventTone,
  filterEvents,
  groupByDay,
} from '../history.ts';

const event = (patch: Partial<BoardEvent>) =>
  ({
    id: 1,
    version: 32,
    kind: 'run',
    entityId: 'run-1',
    actor: 'writer',
    message: 'Fictional message',
    data: {},
    createdAt: '2030-01-10T12:00:00.000Z',
    ...patch,
  }) as BoardEvent;

it('labels and groups newest-first events by local day', () => {
  const now = new Date('2030-01-10T15:00:00');
  expect(dayLabel(new Date('2030-01-10T09:00:00').toISOString(), now)).toBe('Today');
  expect(dayLabel(new Date('2030-01-09T09:00:00').toISOString(), now)).toBe('Yesterday');
  const events = [
    event({ id: 3, createdAt: new Date('2030-01-10T10:00:00').toISOString() }),
    event({ id: 2, createdAt: new Date('2030-01-10T08:00:00').toISOString() }),
    event({ id: 1, createdAt: new Date('2030-01-08T08:00:00').toISOString() }),
  ];
  expect(groupByDay(events, now).map((group) => group.events.map((item) => item.id))).toEqual([
    [3, 2],
    [1],
  ]);
});

it('filters by text, actor or type label and by kind', () => {
  const events = [event({ message: 'Drafted packet' }), event({ kind: 'card', message: 'Moved' })];
  expect(filterEvents(events, 'draft', 'all')).toHaveLength(1);
  expect(filterEvents(events, 'jobs', 'all')).toHaveLength(1);
  expect(filterEvents(events, '', 'card')).toHaveLength(1);
});

it('gives each event one state bead under the bead law', () => {
  expect(eventTone(event({ data: { status: 'running' } as never }), 'running')).toBe('plum');
  expect(eventTone(event({ data: { status: 'running' } as never }), 'completed')).toBeUndefined();
  expect(
    eventTone(event({ kind: 'approval', data: { status: 'pending' } as never }), 'pending'),
  ).toBe('ochre');
  expect(eventTone(event({ kind: 'approval', data: { status: 'pending' } as never }))).toBe(
    undefined,
  );
  expect(
    currentStatus(event({ entityId: 'run-1' }), {
      runs: [{ id: 'run-1', status: 'failed' }],
    } as never),
  ).toBe('failed');
  expect(eventTone(event({ data: { status: 'failed' } as never }))).toBe('rose');
  expect(eventTone(event({ data: { status: 'completed' } as never }))).toBe('done');
  expect(eventTone(event({ kind: 'card', data: { state: 'offer' } as never }))).toBe('moss');
  expect(eventTone(event({ kind: 'card', data: { state: 'rejected' } as never }))).toBeUndefined();
});

it('links an event to its run, conversation, job or page only when it still exists', () => {
  const data = {
    cards: [{ id: 'card-1', company: 'Fictional Co' }],
    conversations: [{ id: 'thread-1', title: 'Fictional chat' }],
  } as unknown as Snapshot;
  expect(activityContext(event({ data: { threadId: 'thread-1' } as never }), data)).toEqual({
    type: 'chat',
    thread: 'thread-1',
    run: 'run-1',
    label: 'Open run',
  });
  expect(
    activityContext(event({ kind: 'message', data: { threadId: 'thread-1' } as never }), data),
  ).toMatchObject({ type: 'chat', thread: 'thread-1', label: 'Fictional chat' });
  expect(activityContext(event({ kind: 'card', entityId: 'card-1' }), data)).toEqual({
    type: 'job',
    cardId: 'card-1',
    label: 'Fictional Co',
  });
  expect(activityContext(event({ kind: 'routine' }), data)).toMatchObject({ to: '/routines' });
  expect(activityContext(event({ kind: 'card', entityId: 'gone' }), data)).toBeNull();
});
