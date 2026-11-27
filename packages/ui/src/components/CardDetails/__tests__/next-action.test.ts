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
    openPacket: vi.fn(),
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
  // Without an agent that can assess forms, the dock opens the form section honestly.
  expect(next.label).toBe('Check application form');
  next.perform();
  expect(base.openApplication).toHaveBeenCalledWith('brief');
  expect(base.brief.startDraft).not.toHaveBeenCalled();
  // With one, it inspects directly; checking it yourself opens the brief editor.
  const inspectForm = vi.fn();
  const setEditing = vi.fn();
  const inspect = jobNextAction({
    ...base,
    card: { ...base.card, url: 'https://example.com/apply' },
    brief: {
      ...base.brief,
      formRoleId: 'submitter',
      formAgents: [{ id: 'submitter' }],
      inspectForm,
      setEditing,
    } as unknown as CardDetailsModel['brief'],
  });
  expect(inspect.label).toBe('Inspect application form');
  inspect.perform();
  expect(inspectForm).toHaveBeenCalledOnce();
  const [manual] = inspect.alternates ?? [];
  expect(manual).toMatchObject({ label: 'I’ll check it myself', quiet: true });
  manual?.perform();
  expect(setEditing).toHaveBeenCalledWith(true);
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
  // Drafting confirmation covers the exact brief, so the dock confirms only while it is on screen.
  const offscreen = jobNextAction({ ...base, brief: editing });
  expect(offscreen).toMatchObject({ label: 'Review brief', kind: 'brief-editing' });
  offscreen.perform();
  expect(base.openApplication).toHaveBeenCalledWith('brief');
  vi.mocked(base.openApplication).mockClear();
  const visible = { ...base, tab: 'application', sections: ['brief'] } as CardDetailsModel;
  expect(jobNextAction({ ...visible, brief: editing })).toMatchObject({
    label: 'Confirm brief',
    disabled: true,
    hint: editing.confirmationHint,
  });
  const next = jobNextAction({
    ...visible,
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
  ).toBe('Check submission evidence');
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
  const exportChoices = {
    format: 'pdf',
    layout: 'formatted',
    requesting: false,
    request: vi.fn(),
  } as unknown as CardDetailsModel['exportChoices'];
  const exporting = jobNextAction({ ...base, exportChoices, card: reviewed });
  expect(exporting.label).toBe('Request export approval');
  exporting.perform();
  expect(exportChoices.request).toHaveBeenCalledOnce();
  const awaiting = { ...reviewed, state: 'awaiting_approval' as const };
  expect(jobNextAction({ ...base, card: awaiting }).label).toBe('Open on Home');
  // Exported files continue on Home; recording stays a secondary move after applying.
  const exported = jobNextAction({ ...base, card: awaiting, exported: true });
  expect(exported.label).toBe('Open on Home');
  // Recording moves the job, so it waits for any request in flight even though it is quiet.
  expect(exported.alternates?.map((item) => [item.label, item.acts])).toEqual([
    ['Record manual submission', true],
  ]);
  const outcome = jobNextAction({ ...base, card: { ...awaiting, state: 'submitted' } });
  expect(outcome).toMatchObject({ label: 'Record outcome', kind: 'outcome' });
  expect(outcome.choices?.map((item) => item.label)).toEqual([
    'Screening',
    'Interviewing',
    'Rejected',
    'Withdrawn',
    'No response',
  ]);
  outcome.choices?.[0]?.perform();
  expect(base.act).toHaveBeenCalledWith(
    '/cards/job/move',
    { state: 'screening' },
    'Moved to Screening',
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
  // Without a pending question there is nothing to answer, only a chat to read.
  expect(jobNextAction({ ...held, agents: [{ run: waiting, name: 'Writer' }] }).label).toBe(
    'Open job chat',
  );
  const asking = {
    ...held,
    data: { ...held.data, userInputs: [{ runId: 'waiting', status: 'pending' }] },
  } as unknown as typeof held;
  expect(jobNextAction({ ...asking, agents: [{ run: waiting, name: 'Writer' }] }).label).toBe(
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
  expect(scored.hint).toContain('Shortlisting only moves it on your board');
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
  // One glaze per lead dock: the alternatives are quiet, and the ledger's Brief row carries the
  // review the brief still needs.
  expect(unscored.alternates?.map((item) => [item.label, item.quiet])).toEqual([
    ['Shortlist', true],
  ]);
  for (const fit of [0, 60]) {
    const scored = unconfirmed(fit);
    expect(scored.label).toBe('Shortlist');
    expect(scored.hint).toContain('confirm the brief before any draft');
    expect(scored.alternates?.map((item) => [item.label, item.quiet])).toEqual([
      ['Evaluate again', true],
    ]);
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
    label: 'Record outcome',
    hint: 'Prepare for your interviews, then record the outcome.',
  });
  expect(next.choices?.map((item) => item.label)).toEqual([
    'Offer',
    'Rejected',
    'Withdrawn',
    'No response',
  ]);
  // A closed job has nothing left to record; the dock invites a lesson instead.
  const closed = jobNextAction({ ...base, card: { ...base.card, state: 'rejected' } });
  expect(closed).toMatchObject({ kind: 'closed', label: 'Add a lesson', quiet: true });
  expect(closed.choices).toBeUndefined();
  // An offer's lone withdrawal is not pushed as the dock's decision; Activity's menu keeps it.
  const offer = jobNextAction({ ...base, card: { ...base.card, state: 'offer' } });
  expect(offer).toMatchObject({ kind: 'outcome', label: 'Add a lesson', quiet: true });
  expect(offer.choices).toBeUndefined();
});

it('marks quiet alternates that start work or move the job, so they wait for a request', () => {
  const base = model({ runRole: 'scout' });
  const data = {
    ...base.data,
    roles: [...base.data.roles, { id: 'scout', enabled: true, runtime: 'codex' }],
  } as CardDetailsModel['data'];
  const lead = { ...base.card, state: 'lead' as const };
  const acting = (next: ReturnType<typeof jobNextAction>) =>
    next.alternates?.map((item) => [item.label, item.quiet, Boolean(item.acts)]);
  expect(acting(jobNextAction({ ...base, data, card: lead }))).toEqual([['Shortlist', true, true]]);
  expect(acting(jobNextAction({ ...base, data, card: { ...lead, fit: 60 } }))).toEqual([
    ['Evaluate again', true, true],
  ]);
  // A scored lead without a brief: its quiet Extract brief follows the brief column's busy state.
  const scored = jobNextAction({
    ...base,
    data,
    card: { ...lead, fit: 60 },
    brief: {
      ...base.brief,
      loaded: { ...base.brief.loaded!, context: null },
      available: [{ id: 'writer', name: 'Writer' }],
      disabled: true,
      extract: vi.fn(),
    } as unknown as CardDetailsModel['brief'],
  });
  expect(scored.alternates?.[0]).toMatchObject({
    label: 'Extract brief',
    quiet: true,
    acts: true,
    disabled: true,
  });
  // Navigation stays usable while a request runs.
  const revise = jobNextAction({
    ...base,
    card: { ...base.card, state: 'changes_requested', packet: {}, feedback: ['Shorter'] },
  } as unknown as CardDetailsModel);
  expect(acting(revise)).toEqual([['Read requests', true, false]]);
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
  expect(revision.label).toBe('Revise application');
  expect(revision.hint).toBeFalsy();
});

it('extracts the brief from the dock when an application agent is available', () => {
  const base = model();
  const extract = vi.fn(() => Promise.resolve());
  const setEditing = vi.fn();
  const next = jobNextAction({
    ...base,
    card: { ...base.card, state: 'lead' },
    brief: {
      ...base.brief,
      loaded: { ...base.brief.loaded!, context: null },
      available: [{ id: 'writer' }],
      extract,
      setEditing,
    } as unknown as CardDetailsModel['brief'],
  });
  expect(next).toMatchObject({
    label: 'Extract brief',
    kind: 'prepare-brief',
    intent: 'extract-brief',
  });
  expect(next.alternates?.[0]?.intent).toBe('write-brief');
  expect(next.alternates?.map((item) => item.label)).toEqual(['Write it myself', 'Shortlist']);
  next.perform();
  expect(extract).toHaveBeenCalledOnce();
  // Write it myself opens the brief editor itself, so the column needn't repeat the choice.
  next.alternates?.[0]?.perform();
  expect(base.openApplication).toHaveBeenCalledWith('brief');
  expect(setEditing).toHaveBeenCalledWith(true);
});

it('verifies captured submission evidence from the dock and keeps other evidence reachable', () => {
  const base = model();
  const attempt = {
    id: 'attempt',
    status: 'uncertain',
    confirmation: { url: 'https://example.com', text: 'Received.' },
  };
  const next = jobNextAction({
    ...base,
    card: { ...base.card, submissionAttempts: [attempt] } as unknown as CardDetailsModel['card'],
  });
  expect(next).toMatchObject({ label: 'I verified submission', kind: 'uncertain' });
  expect(next.alternates?.map((item) => item.label)).toEqual([
    'Other evidence',
    'I verified it was not submitted',
  ]);
  next.perform();
  expect(base.act).toHaveBeenCalledWith(
    '/submissions/attempt/resolve',
    { confirmed: true, reason: 'User verified captured website submission confirmation' },
    'Submission verified',
  );
  next.alternates?.[1]?.perform();
  expect(base.act).toHaveBeenLastCalledWith(
    '/submissions/attempt/resolve',
    {
      confirmed: false,
      reason: 'User verified no submission occurred; browser actions may resume',
    },
    'Outcome resolved; submission may be attempted again',
  );
  next.alternates?.[0]?.perform();
  expect(base.setTab).toHaveBeenCalledWith('activity');
});

it('opens the brief ready to confirm and lets an older score lead a lead without a brief', () => {
  const base = model();
  const setEditing = vi.fn();
  const unconfirmed = { ...base.brief, confirmed: false, setEditing };
  const review = jobNextAction({ ...base, brief: unconfirmed });
  expect(review.label).toBe('Review brief');
  review.perform();
  expect(base.openApplication).toHaveBeenLastCalledWith('brief');
  expect(setEditing).toHaveBeenCalledWith(true);
  const extract = vi.fn(() => Promise.resolve());
  const lead = jobNextAction({
    ...base,
    card: { ...base.card, state: 'lead', fit: 82 },
    brief: {
      ...base.brief,
      loaded: { context: null },
      available: [{ id: 'writer' }],
      extract,
    } as unknown as CardDetailsModel['brief'],
  });
  expect(lead).toMatchObject({ kind: 'shortlist', label: 'Shortlist' });
  // The brief column defers by intent, not wording: this dock extracts but offers no manual brief.
  expect(lead.alternates?.map((item) => item.intent)).toEqual(['extract-brief']);
  lead.alternates?.[0]?.perform();
  expect(extract).toHaveBeenCalledOnce();
});

it('offers the full list of requested changes beside Revise application', () => {
  const base = model();
  const card = {
    ...base.card,
    state: 'changes_requested' as const,
    packet: { resume: 'r' },
    feedback: ['Separate the guild review from Lumen Ledger.', 'Shorten the opening.'],
  } as unknown as CardDetailsModel['card'];
  const next = jobNextAction({ ...base, card });
  expect(next.label).toBe('Revise application');
  // The dock quotes the first request; Reviews holds them all.
  expect(next.alternates?.map((item) => [item.label, item.quiet])).toEqual([
    ['Read requests', true],
  ]);
  next.alternates?.[0]?.perform();
  expect(base.openApplication).toHaveBeenLastCalledWith('reviews');
});
