import { expect, it, vi } from 'vitest';
import type { CardDetailsModel } from '../types.ts';
import { jobNextAction } from '../next-action.ts';
function model(patch: Partial<CardDetailsModel> = {}): CardDetailsModel {
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
}
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
it('prioritizes live cancellation, user questions and uncertain submission outcomes', () => {
  const base = model();
  const run = { id: 'active', status: 'running', message: 'Working' } as NonNullable<
    CardDetailsModel['run']
  >;
  const next = jobNextAction({ ...base, run });
  next.perform();
  expect(base.act).toHaveBeenCalledWith('/runs/active/cancel');
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
