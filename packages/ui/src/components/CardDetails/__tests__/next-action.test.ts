import { expect, it, vi } from 'vitest';
import type { Run } from '@pitchcrew/core';
import type { CardDetailsModel } from '../types.ts';
import { jobNextAction } from '../next-action.ts';
const model = (patch: Partial<CardDetailsModel> = {}): CardDetailsModel => {
  return {
    card: { id: 'job', state: 'shortlisted', owner: null, packet: null },
    data: {
      roles: [{ id: 'writer', enabled: true, runtime: 'codex' }],
      runs: [],
      runtimes: [{ id: 'codex', available: true }],
      profile: [{ content: 'Fictional experience' }],
    },
    brief: {
      loaded: { context: {} },
      confirmed: true,
      draft: { requirements: [] },
      roleId: 'writer',
      startDraft: vi.fn(),
      reviewPacket: vi.fn(),
      reviewer: { id: 'writer' },
    },
    agents: [],
    exported: false,
    runRole: 'writer',
    act: vi.fn(),
    openApplication: vi.fn(),
    setTab: vi.fn(),
    openInbox: vi.fn(),
    openChat: vi.fn(),
    ...patch,
  } as unknown as CardDetailsModel;
};
it('requires a current confirmed brief and personal answers before the single draft action', () => {
  const base = model();
  expect(
    jobNextAction({
      ...base,
      brief: { ...base.brief, loaded: { ...base.brief.loaded!, context: null } },
    }).label,
  ).toBe('Prepare brief');
  expect(jobNextAction({ ...base, brief: { ...base.brief, confirmed: false } }).label).toBe(
    'Review brief',
  );
  const missing = {
    ...base.brief,
    draft: {
      ...base.brief.draft,
      requirements: [{ id: 'why', question: 'Why?', personal: true, required: true, answer: '' }],
    },
  };
  expect(jobNextAction({ ...base, brief: missing }).label).toBe('Answer requirements');
  const next = jobNextAction(base);
  expect(next.label).toBe('Draft application');
  next.perform();
  expect(base.brief.startDraft).toHaveBeenCalledOnce();
  expect(base.act).not.toHaveBeenCalled();
});
it.each(['other-job', null])(
  'allows application actions while the same agent runs in a separate queue (%s)',
  (cardId) => {
    for (const state of ['lead', 'shortlisted', 'in_review'] as const) {
      const base = model();
      const next = jobNextAction({
        ...base,
        card: { ...base.card, state, packet: {} as NonNullable<typeof base.card.packet> },
        data: {
          ...base.data,
          runs: [{ id: 'other-run', roleId: 'writer', cardId, status: 'running' } as Run],
        },
      });
      expect(next.label).toBe(
        state === 'lead'
          ? 'Evaluate fit'
          : state === 'shortlisted'
            ? 'Draft application'
            : 'Review packet',
      );
      expect(next.disabled).toBe(false);
      expect(next.hint).toBeNull();
      next.perform();
      if (state === 'lead')
        expect(base.act).toHaveBeenCalledWith(
          '/cards/job/run',
          { roleId: 'writer' },
          'Fit evaluation started',
        );
      else if (state === 'shortlisted') expect(base.brief.startDraft).toHaveBeenCalledOnce();
      else expect(base.brief.reviewPacket).toHaveBeenCalledOnce();
    }
  },
);
it('prioritizes live cancellation, user questions and uncertain submission outcomes', () => {
  const base = model();
  const run = { id: 'active', status: 'running', message: 'Working' } as NonNullable<
    CardDetailsModel['run']
  >;
  const next = jobNextAction({ ...base, run });
  next.perform();
  expect(base.act).toHaveBeenCalledWith('/runs/active/cancel');
  expect(jobNextAction({ ...base, card: { ...base.card, owner: 'writer' } })).toMatchObject({
    label: 'Work in progress',
    disabled: true,
  });
  const waiting = { ...run, status: 'waiting' as const, threadId: 'job-chat' };
  jobNextAction({ ...base, agents: [{ run: waiting, name: 'Writer' }] }).perform();
  expect(base.openChat).toHaveBeenCalledWith('job-chat', run.id);
  expect(
    jobNextAction({
      ...base,
      card: {
        ...base.card,
        submissionAttempts: [{ status: 'uncertain' }] as NonNullable<
          typeof base.card.submissionAttempts
        >,
      },
    }).label,
  ).toBe('Verify submission');
});
it('keeps packet review, export approval and manual submission as distinct decisions', () => {
  const base = model();
  const card = {
    ...base.card,
    state: 'agreed' as const,
    packet: {} as NonNullable<typeof base.card.packet>,
    applicationContext: { revision: 'current' } as NonNullable<typeof base.card.applicationContext>,
  };
  expect(jobNextAction({ ...base, card }).label).toBe('Review packet');
  const reviewed = {
    ...card,
    packetReview: { contextRevision: 'current' } as NonNullable<typeof card.packetReview>,
  };
  expect(jobNextAction({ ...base, card: reviewed }).label).toBe('Prepare export');
  const awaiting = { ...reviewed, state: 'awaiting_approval' as const };
  expect(jobNextAction({ ...base, card: awaiting }).label).toBe('Open approval inbox');
  expect(jobNextAction({ ...base, card: awaiting, exported: true }).label).toBe(
    'Record manual submission',
  );
  expect(jobNextAction({ ...base, card: { ...awaiting, state: 'submitted' } }).label).toBe(
    'Update outcome',
  );
});

it('acknowledges startup and lets held work open Queue without hiding user questions', () => {
  const base = model();
  const openQueue = vi.fn();
  const work = {
    pending: undefined,
    starting: true,
    spinning: false,
    label: 'Agent on hold',
    reason: 'Confirm the job brief.',
    roleId: null,
  };
  const held = { ...base, work, openQueue };
  const next = jobNextAction(held);
  expect(next.label).toBe('View queued action');
  expect(next.disabled).toBe(false);
  next.perform();
  expect(openQueue).toHaveBeenCalledOnce();
  expect(jobNextAction({ ...held, work: { ...work, spinning: true } })).toMatchObject({
    label: 'Starting agent…',
    disabled: true,
  });
  const waiting = { id: 'waiting', status: 'waiting', threadId: 'application' } as Run;
  expect(jobNextAction({ ...held, agents: [{ run: waiting, name: 'Writer' }] }).label).toBe(
    'Answer in job chat',
  );
});
