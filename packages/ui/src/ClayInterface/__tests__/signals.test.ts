import { describe, expect, it } from 'vitest';
import type { Card, Snapshot } from '@pitchcrew/core';
import { decisions, jobSignals } from '../signals.ts';
import { timelineRuns } from '../helpers.ts';

const card = (id: string, fields: Partial<Card> = {}) =>
  ({
    id,
    company: id,
    title: 'Engineer',
    state: 'lead',
    updatedAt: '2026-10-30T09:00:00.000Z',
    ...fields,
  }) as Card;

const snapshot = (fields: Partial<Snapshot>) =>
  ({ cards: [], roles: [], runs: [], approvals: [], computerApprovals: [], ...fields }) as Snapshot;

describe('clay decisions', () => {
  it('asks to confirm only briefs whose current revision is unconfirmed', () => {
    const context = { revision: 'b', createdAt: '2026-10-30T08:00:00.000Z' };
    const data = snapshot({
      cards: [
        card('open', { applicationContext: context as Card['applicationContext'] }),
        card('done', {
          applicationContext: {
            ...context,
            confirmedAt: 'x',
            confirmedRevision: 'b',
          } as Card['applicationContext'],
        }),
        card('closed', {
          state: 'withdrawn',
          applicationContext: context as Card['applicationContext'],
        }),
      ],
    });
    expect(decisions(data).map((item) => item.cardId)).toEqual(['open']);
  });

  it('pairs a running job with its agent and keeps the ask on top', () => {
    const data = snapshot({
      cards: [card('job')],
      runs: [{ id: 'r', roleId: 'writer', cardId: 'job', status: 'running' }] as Snapshot['runs'],
      userInputs: [
        {
          id: 'q',
          cardId: 'job',
          roleId: 'scout',
          threadId: 't',
          status: 'pending',
          question: 'Overlap?',
          createdAt: '2026-10-30T10:00:00.000Z',
        },
      ] as Snapshot['userInputs'],
    });
    const signal = jobSignals(data).get('job');
    expect(signal?.run?.id).toBe('r');
    expect(signal?.decision?.kind).toBe('question');
  });
});

describe('clay run timeline', () => {
  it('places today’s runs between 08:00 and now and ignores earlier days', () => {
    const now = new Date(2026, 9, 30, 12, 0).getTime();
    const at = (hour: number) => new Date(2026, 9, 30, hour).toISOString();
    const { runs } = timelineRuns(
      [
        { id: 'a', startedAt: at(10), finishedAt: at(11), status: 'completed' },
        {
          id: 'b',
          startedAt: new Date(2026, 9, 29, 10).toISOString(),
          finishedAt: null,
          status: 'completed',
        },
      ],
      now,
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]?.left).toBeCloseTo(50);
    expect(runs[0]?.width).toBeCloseTo(25);
  });
});
