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
      runtimes: [{ id: 'codex', available: true, applicationIsolation: true }],
      profile: [{ content: 'Fictional experience' }],
      approvals: [],
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

it('directs linked applications to form inspection before the draft action', () => {
  const base = model();
  const next = jobNextAction({ ...base, card: { ...base.card, url: 'https://example.com/apply' } });
  expect(next.label).toBe('Inspect application form');
  next.perform();
  expect(base.openApplication).toHaveBeenCalledWith('brief');
  expect(base.brief.startDraft).not.toHaveBeenCalled();
  expect(
    jobNextAction({
      ...base,
      card: { ...base.card, url: 'https://example.com/apply' },
      brief: { ...base.brief, draft: { ...base.brief.draft, form: { status: 'manual' } } },
    }).label,
  ).toBe('Draft application');
});
it('confirms from the footer through the same guarded brief action', () => {
  const base = model();
  const confirm = vi.fn();
  const editing = {
    ...base.brief,
    editing: true,
    confirm,
    confirmDisabled: true,
    confirmationHint:
      'Inspect the application form, or choose to check it yourself, before confirming.',
  };
  expect(jobNextAction({ ...base, brief: editing })).toMatchObject({
    label: 'Confirm brief',
    disabled: true,
    hint: editing.confirmationHint,
  });
  const next = jobNextAction({
    ...base,
    brief: { ...editing, confirmDisabled: false, confirmationHint: '' },
  });
  expect(next.disabled).toBe(false);
  next.perform();
  expect(confirm).toHaveBeenCalledOnce();
  expect(base.openApplication).not.toHaveBeenCalled();
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
  // An answered question has handed the turn back; there is nothing left to answer.
  expect(
    jobNextAction({ ...base, agents: [{ run: waiting, name: 'Writer', handedOff: true }] }).label,
  ).not.toBe('Answer in job chat');
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
  expect(jobNextAction({ ...base, card: awaiting }).label).toBe('Open in Decisions');
  // Exported files continue in Decisions; recording stays a secondary move after applying.
  const exported = jobNextAction({ ...base, card: awaiting, exported: true });
  expect(exported.label).toBe('Continue application');
  expect(exported.alternates?.map((item) => item.label)).toEqual(['Record manual submission']);
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

it('offers Shortlist first for a scored lead while evaluation stays reachable', () => {
  const base = model({ runRole: 'scout' });
  const data = {
    ...base.data,
    roles: [...base.data.roles, { id: 'scout', enabled: true, runtime: 'codex' }],
  } as CardDetailsModel['data'];
  const unscored = jobNextAction({ ...base, data, card: { ...base.card, state: 'lead' } });
  expect(unscored.label).toBe('Evaluate fit');
  expect(unscored.alternates?.map((item) => item.label)).toEqual(['Shortlist']);
  const scored = jobNextAction({ ...base, data, card: { ...base.card, state: 'lead', fit: 60 } });
  expect(scored.label).toBe('Shortlist');
  expect(scored.hint).toContain('60/100');
  scored.perform();
  expect(base.act).toHaveBeenCalledWith('/cards/job/move', { state: 'shortlisted' }, 'Shortlisted');
  const again = scored.alternates?.[0];
  expect(again).toMatchObject({ label: 'Evaluate again', disabled: false });
  again?.perform();
  expect(base.act).toHaveBeenCalledWith(
    '/cards/job/run',
    { roleId: 'scout' },
    'Fit evaluation started',
  );
});

it('asks a lead for its brief before fit without hiding Shortlist', () => {
  const base = model();
  const lead = { ...base.card, state: 'lead' as const };
  const missing = jobNextAction({
    ...base,
    card: lead,
    brief: { ...base.brief, loaded: { ...base.brief.loaded!, context: null } },
  });
  expect(missing.label).toBe('Prepare brief');
  expect(missing.alternates?.map((item) => item.label)).toEqual(['Shortlist']);
  // An extracted but unconfirmed brief does not hold a lead: fit, then Shortlist, lead.
  const unconfirmed = (fit: number | null) =>
    jobNextAction({
      ...base,
      card: { ...lead, fit },
      brief: { ...base.brief, confirmed: false },
    });
  const unscored = unconfirmed(null);
  expect(unscored.label).toBe('Evaluate fit');
  expect(unscored.alternates?.map((item) => item.label)).toEqual(['Shortlist', 'Review brief']);
  for (const fit of [0, 60]) {
    const scored = unconfirmed(fit);
    expect(scored.label).toBe('Shortlist');
    expect(scored.hint).toContain(`Fit ${fit}/100`);
    expect(scored.hint).toContain('confirm the brief before drafting');
    expect(scored.alternates?.map((item) => item.label)).toEqual([
      'Evaluate again',
      'Review brief',
    ]);
    scored.alternates?.[1]?.perform();
    expect(base.openApplication).toHaveBeenLastCalledWith('brief');
  }
  // Once shortlisted, confirmation is required again before drafting.
  const shortlisted = jobNextAction({ ...base, brief: { ...base.brief, confirmed: false } });
  expect(shortlisted.label).toBe('Review brief');
  expect(shortlisted.alternates).toBeUndefined();
});

it('names the recorded outcome in the post-submission hint', () => {
  const base = model();
  const next = jobNextAction({ ...base, card: { ...base.card, state: 'interviewing' } });
  expect(next).toMatchObject({
    label: 'Update outcome',
    hint: 'Prepare for your interviews, then record the outcome.',
  });
});
it('drafts the first packet, not a revision, when requested changes have no saved packet', () => {
  const base = model();
  const failedFirst = jobNextAction({
    ...base,
    card: { ...base.card, state: 'changes_requested', packet: null },
  });
  expect(failedFirst).toMatchObject({
    label: 'Draft application',
    hint: 'No packet has been saved yet. This drafts the first packet.',
  });
  failedFirst.perform();
  expect(base.brief.startDraft).toHaveBeenCalledOnce();
  const revision = jobNextAction({
    ...base,
    card: { ...base.card, state: 'changes_requested', packet: {} },
  } as CardDetailsModel);
  expect(revision.label).toBe('Draft application');
  expect(revision.hint).toBeFalsy();
});
