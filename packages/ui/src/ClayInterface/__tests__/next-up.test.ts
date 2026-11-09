import { describe, expect, it } from 'vitest';
import type { Card, Role, Run, Snapshot } from '@pitchcrew/core';
import { nextUp } from '../jobs.ts';
import { decisions, jobSignals } from '../signals.ts';
import { stepLabel, trackIndex } from '../helpers.ts';

const confirmed = {
  revision: 'r1',
  confirmedAt: '2026-11-08T09:00:00.000Z',
  confirmedRevision: 'r1',
  createdAt: '2026-11-08T08:00:00.000Z',
  requirements: [],
} as unknown as Card['applicationContext'];
const card = (fields: Partial<Card> = {}) =>
  ({
    id: 'job',
    company: 'Example Studio',
    title: 'Frontend Engineer',
    state: 'lead',
    fit: null,
    packet: null,
    url: '',
    updatedAt: '2026-11-08T09:00:00.000Z',
    ...fields,
  }) as Card;
const roles = [
  { id: 'scout', name: 'Scout', enabled: true, workflow: 'scout' },
  { id: 'writer', name: 'Writer', enabled: true, workflow: 'writer' },
  { id: 'reviewer', name: 'Reviewer', enabled: true, workflow: 'reviewer' },
] as Role[];
const next = (job: Card, fields: Partial<Snapshot> = {}) =>
  nextUp(job, {
    cards: [job],
    roles,
    runs: [],
    approvals: [],
    computerApprovals: [],
    ...fields,
  } as Snapshot)?.text;

describe('next up', () => {
  it('follows the brief and fit gates instead of the stage alone', () => {
    expect(next(card())).toBe('Next: you prepare the job brief');
    expect(next(card({ applicationContext: confirmed }))).toBe('Next: Scout checks the fit');
    expect(next(card({ applicationContext: confirmed, fit: 64 }))).toBe(
      'Next: you decide whether to shortlist',
    );
  });

  it('lets an unconfirmed lead lead with fit and shortlisting, and asks again once shortlisted', () => {
    const unconfirmed = { ...confirmed!, confirmedRevision: 'old' };
    for (const [fit, text] of [
      [null, 'Next: Scout checks the fit'],
      [0, 'Next: you decide whether to shortlist'],
      [60, 'Next: you decide whether to shortlist'],
    ] as const) {
      const job = card({ applicationContext: unconfirmed, fit });
      const data = {
        cards: [job],
        roles,
        runs: [],
        approvals: [],
        computerApprovals: [],
      } as unknown as Snapshot;
      // The board's Needs you deck and the stage line agree: no brief decision for a lead.
      expect(decisions(data)).toEqual([]);
      expect(jobSignals(data).get('job')).toBeUndefined();
      expect(nextUp(job, data)?.text).toBe(text);
    }
    // Shortlisting brings the confirmation back before drafting.
    expect(next(card({ state: 'shortlisted', applicationContext: unconfirmed, fit: 60 }))).toMatch(
      /^Waiting on you: Confirm the Example Studio brief/,
    );
  });

  it('names form, review and approval steps truthfully', () => {
    expect(
      next(
        card({ state: 'shortlisted', url: 'https://example.com/a', applicationContext: confirmed }),
      ),
    ).toBe('Next: you check the application form');
    expect(next(card({ state: 'shortlisted', applicationContext: confirmed }))).toBe(
      'Next: Writer drafts the packet',
    );
    const packet = {} as Card['packet'];
    // A packetless changes_requested job (a failed first draft) drafts again; a saved one revises.
    expect(next(card({ state: 'changes_requested', applicationContext: confirmed }))).toBe(
      'Next: Writer drafts the packet',
    );
    expect(next(card({ state: 'changes_requested', packet, applicationContext: confirmed }))).toBe(
      'Next: Writer revises the packet',
    );
    expect(next(card({ state: 'in_review', packet, applicationContext: confirmed }))).toBe(
      'Next: Reviewer reviews the packet',
    );
    const reviewed = {
      packet,
      applicationContext: confirmed,
      packetReview: { contextRevision: 'r1' } as Card['packetReview'],
    };
    expect(next(card({ state: 'agreed', ...reviewed }))).toBe(
      'Next: you prepare the export for approval',
    );
  });

  it('keeps a running agent and the recorded outcome in view', () => {
    const job = card({ state: 'interviewing', applicationContext: confirmed });
    expect(next(job)).toBe('Next: you prepare for interviews and record the outcome');
    expect(next(card({ state: 'submitted' }))).toBe('Next: you record their reply');
    const run = { id: 'run', roleId: 'writer', cardId: 'job', status: 'running' } as Run;
    expect(next(job, { runs: [run] })).toBe('Writer is working');
    expect(next(card({ state: 'rejected' }))).toBeUndefined();
  });
});

describe('stage labels', () => {
  it('names the recorded outcome on the current Applied step only', () => {
    const applied = trackIndex('submitted')!;
    expect(stepLabel('submitted', applied)).toBe('Applied');
    expect(stepLabel('screening', applied)).toBe('Screening');
    expect(stepLabel('interviewing', applied)).toBe('Interviewing');
    expect(stepLabel('offer', applied)).toBe('Offer');
    expect(stepLabel('lead', applied)).toBe('Applied');
    expect(stepLabel('interviewing', 0)).toBe('Lead');
  });
});
