import { describe, expect, it } from 'vitest';
import type { BoardEvent, Snapshot } from '@pitchcrew/core';
import { attentionItems } from '../attention.ts';
import {
  sinceEmpty,
  sinceExplainer,
  sinceLines,
  sinceShown,
  sinceSummary,
  sinceWindow,
  type SinceLine,
} from '../since.ts';
import { clockLabel, sinceLabel } from '../time.ts';
import {
  ago,
  card,
  delivery,
  instructionUpdate,
  now,
  question,
  queue,
  request,
  run,
  signal,
  snapshot,
} from './attention-fixture.ts';

const hour = 3_600_000;
const from = now - 10 * hour;

describe('the since window', () => {
  it('reads the stored time, else the last 24 hours, and never more than 7 days', () => {
    expect(sinceWindow(null, now)).toMatchObject({
      from: now - 24 * hour,
      kind: 'default',
      label: 'In the last 24 hours',
    });
    expect(sinceWindow('not a time', now).kind).toBe('default');
    expect(sinceWindow(new Date(now - 8 * 24 * hour).toISOString(), now)).toMatchObject({
      from: now - 7 * 24 * hour,
      kind: 'capped',
      label: 'In the last 7 days',
    });
    const seen = new Date(now - 2 * hour).toISOString();
    expect(sinceWindow(seen, now)).toEqual({
      from: now - 2 * hour,
      kind: 'seen',
      label: `since ${sinceLabel(now - 2 * hour, now)}`,
      time: sinceLabel(now - 2 * hour, now),
    });
    // A clock running behind the stored time shows nothing rather than the future.
    expect(sinceWindow(new Date(now + hour).toISOString(), now).from).toBe(now);
    const range = sinceWindow(seen, now);
    expect(sinceEmpty(range)).toBe(`Nothing recorded since ${range.time}.`);
    expect(sinceExplainer).toBe('Pitchcrew records crew work only while it is running.');
  });
});

/** A morning: finished, failed and stopped runs, a late routine, asks, a recorded status, leads. */
const morning = () => {
  const data = snapshot({
    cards: [
      card('lumen', { company: 'Lumen Labs' }),
      card('acme', { company: 'Acme Robotics', state: 'drafting' }),
      card('bluefin', { company: 'Bluefin', state: 'screening' }),
      card('marlow', { company: 'Marlow', state: 'rejected' }),
      card('new-1', { company: 'Northwind', createdAt: ago(30) }),
      card('new-2', { company: 'Kestrel AI', createdAt: ago(20) }),
      card('old', { company: 'Tidepool', createdAt: ago(1000) }),
    ],
    runs: [
      run('fit', {
        cardId: 'lumen',
        roleId: 'scout',
        purpose: 'fit',
        status: 'completed',
        finishedAt: ago(120),
      }),
      run('draft', {
        cardId: 'acme',
        purpose: 'application-draft',
        status: 'failed',
        finishedAt: ago(90),
      }),
      run('chat', { threadId: 't-prep', status: 'cancelled', finishedAt: ago(60) }),
      run('routine', {
        roleId: 'tracker',
        routineId: 'morning',
        scheduledFor: ago(200),
        startedAt: ago(180),
        status: 'completed',
        finishedAt: ago(170),
      }),
      run('before', { cardId: 'lumen', status: 'completed', finishedAt: ago(700) }),
      run('seat', {
        cardId: 'acme',
        status: 'completed',
        finishedAt: ago(5),
        reviewSeatReservation: true,
      }),
      run('live', { cardId: 'acme', status: 'running' }),
    ],
    routines: [{ id: 'morning', name: 'Morning scan' } as Snapshot['routines'][number]],
    conversations: [
      { id: 't-prep', title: 'Interview prep' } as NonNullable<Snapshot['conversations']>[number],
    ],
    userInputs: [
      question('fresh', { cardId: 'acme', createdAt: ago(40) }),
      question('stale', { cardId: 'old', createdAt: ago(900) }),
    ],
    trackingSignals: [
      signal('screen', { cardId: 'bluefin', status: 'applied', decidedAt: ago(100) }),
      signal('reject', {
        cardId: 'marlow',
        company: 'Marlow',
        status: 'applied',
        state: 'rejected',
        decidedAt: ago(80),
      }),
      signal('pending', { cardId: 'bluefin' }),
    ],
    // Snapshot events are capped and noisy; nothing is read from them.
    events: [
      {
        id: 1,
        kind: 'card',
        actor: 'user',
        createdAt: ago(1),
        message: 'Noise',
      } as unknown as BoardEvent,
    ],
  });
  return { data, items: attentionItems(data) };
};

describe('since lines', () => {
  it('tells each source in its own words, newest first', () => {
    const { data, items } = morning();
    const lines = sinceLines(data, from, items);
    expect(lines.map((line) => [line.id, line.tone, line.text])).toEqual([
      ['leads', undefined, '2 new leads'],
      ['item:question:fresh', 'ochre', 'Question from Writer · Acme Robotics'],
      ['run:chat', undefined, 'Stopped: Writer’s reply on Interview prep'],
      ['tracking:reject', 'primary', 'Recorded Rejected for Marlow'],
      ['run:draft', 'rose', 'Writer’s draft on Acme Robotics failed'],
      // The still-pending review on Bluefin was asked at the same minute.
      ['item:tracking:pending', 'ochre', 'Tracking review · Bluefin'],
      ['tracking:screen', 'moss', 'Recorded Screening for Bluefin'],
      ['run:fit', 'primary', 'Scout evaluated fit for Lumen Labs'],
      [
        'run:routine',
        'primary',
        `Tracker ran Morning scan (scheduled ${clockLabel(ago(200))}, started ${clockLabel(ago(180))})`,
      ],
    ]);
    // No actor is stored for a recorded status, so no line credits the Tracker with it.
    expect(
      lines.filter((line) => line.kind === 'recorded').some((line) => /Tracker/.test(line.text)),
    ).toBe(false);
  });

  it('opens a job’s item, else the job, else the run', () => {
    const { data, items } = morning();
    const target = (id: string) =>
      sinceLines(data, from, items).find((line) => line.id === id)?.target;
    expect(target('run:draft')).toEqual({ item: 'question:fresh' });
    expect(target('run:fit')).toEqual({ cardId: 'lumen' });
    expect(target('run:chat')).toEqual({ thread: 't-prep', run: 'chat' });
    expect(target('tracking:screen')).toEqual({ item: 'tracking:pending' });
    // Every new lead, scored or not, so Pipeline itself: a Not scored view would show fewer.
    expect(target('leads')).toEqual({ to: '/pipeline' });
  });

  it('words work the daemon found unfinished as Needs you does: interrupted, never failed', () => {
    // On start-up the daemon fails the run with this message, stamped at the restart, and pauses
    // its job queue as interrupted (orchestrator crew/lifecycle.ts).
    const data = snapshot({
      cards: [card('lumen', { company: 'Lumen Labs' })],
      runs: [
        run('run-fit', {
          cardId: 'lumen',
          roleId: 'scout',
          purpose: 'fit',
          status: 'failed',
          message: 'The daemon stopped during this run. Retry the role.',
          startedAt: ago(600),
          finishedAt: ago(5),
        }),
      ],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:lumen', {
            paused: true,
            pauseKind: 'interrupted',
            state: 'paused',
            reason: 'Interrupted by daemon restart. Retry or skip this request.',
            requests: [
              request('fit-lumen', {
                boardAction: 'fit',
                deliveries: [delivery('scout', 'paused', 'run-fit')],
              }),
            ],
          }),
        ],
      },
    });
    const lines = sinceLines(data, from, attentionItems(data));
    // Its one time is the restart that found it, named as such: never when Pitchcrew stopped.
    expect(lines.map((line) => [line.id, line.kind, line.tone, line.text])).toEqual([
      ['item:failure:job:lumen', 'ask', 'ochre', 'Interrupted request · Lumen Labs'],
      [
        'run:run-fit',
        'interrupted',
        undefined,
        `Scout’s fit evaluation on Lumen Labs was interrupted when Pitchcrew stopped (found at restart, ${clockLabel(ago(5))})`,
      ],
    ]);
    expect(sinceSummary(lines)).toBe('1 interrupted · 1 new ask');
  });

  it('keeps a new ask’s Needs you bead: rose for a failed request', () => {
    const data = snapshot({
      cards: [card('corvid', { company: 'Corvid' })],
      queue: {
        concurrency: 5,
        active: 0,
        background: 0,
        queues: [
          queue('job:corvid', {
            paused: true,
            pauseKind: 'failed',
            state: 'paused',
            reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
            requests: [
              request('fit-corvid', {
                boardAction: 'fit',
                createdAt: ago(55),
                deliveries: [delivery('scout', 'failed', null)],
              }),
            ],
          }),
        ],
      },
    });
    const items = attentionItems(data);
    expect(items.map((item) => [item.key, item.tone])).toEqual([['failure:job:corvid', 'rose']]);
    expect(sinceLines(data, from, items).map((line) => [line.kind, line.tone, line.text])).toEqual([
      ['ask', 'rose', 'Failed request · Corvid'],
    ]);
  });

  it('never lists a new default instruction version, whose only time is its release date', () => {
    const data = snapshot({
      instructionUpdates: [
        instructionUpdate('scout', {
          changes: [{ revision: 'a'.repeat(16), date: '2026-11-18', summary: 'Reads the range.' }],
        }),
      ],
    });
    const items = attentionItems(data);
    // Ranked from midnight UTC, inside the window, but no clock time says when it arrived.
    expect(items.map((item) => [item.kind, item.askedAt])).toEqual([
      ['instruction-update', '2026-11-18T00:00:00.000Z'],
    ]);
    expect(sinceLines(data, from, items)).toEqual([]);
  });

  it('says “a routine” once its routine is deleted', () => {
    // The snapshot leaves deleted routines out, while their runs keep the routine's id.
    const data = snapshot({
      cards: [card('lumen', { company: 'Lumen Labs' })],
      runs: [
        run('scan', {
          roleId: 'tracker',
          routineId: 'gone',
          status: 'completed',
          finishedAt: ago(30),
        }),
        run('job', {
          roleId: 'scout',
          routineId: 'gone',
          cardId: 'lumen',
          status: 'completed',
          finishedAt: ago(20),
        }),
        run('broken', {
          roleId: 'tracker',
          routineId: 'gone',
          status: 'failed',
          finishedAt: ago(10),
        }),
      ],
    });
    expect(sinceLines(data, from, []).map((line) => line.text)).toEqual([
      'Tracker’s routine failed',
      'Scout ran a routine for Lumen Labs',
      'Tracker ran a routine',
    ]);
  });

  it('builds nothing from snapshot events and nothing before the window', () => {
    const { data } = morning();
    expect(
      sinceLines({ ...data, runs: [], userInputs: [], trackingSignals: [], cards: [] }, from, []),
    ).toEqual([]);
    expect(sinceLines(data, now, attentionItems(data))).toEqual([]);
  });

  it('sums the lines, leaving out zero parts', () => {
    const { data, items } = morning();
    expect(sinceSummary(sinceLines(data, from, items))).toBe(
      '2 finished · 1 failed · 1 stopped · 2 new asks · 2 recorded · 2 new leads',
    );
    expect(sinceSummary([])).toBe('');
  });

  it('shows the newest 40 and leaves the rest to Activity', () => {
    const lines = Array.from({ length: 45 }, (_, index): SinceLine => ({
      id: `line-${index}`,
      at: ago(index),
      kind: 'finished',
      tone: 'primary',
      who: 'writer',
      text: `Line ${index}`,
      target: null,
    }));
    const { shown, more } = sinceShown(lines);
    expect(shown).toHaveLength(40);
    expect(more).toEqual({ count: 5, text: '5 more in Activity', to: '/activity' });
    expect(sinceShown(lines.slice(0, 3)).more).toBeNull();
  });
});
