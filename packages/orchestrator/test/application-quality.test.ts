import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { CareerPlan, GapInput, Run, WritingCorrection } from '@pitchcrew/core';
import { createCrewContext } from '../src/crew/context.ts';
import { qualityUserAction } from '../src/quality/user.ts';
import { writingGuide, finishWritingCorrection } from '../src/quality/writing.ts';
import { currentPlan, planCards, planRevision, refreshPlan } from '../src/quality/plans.ts';
import { qualitySnapshot } from '../src/quality/snapshot.ts';
import { documentReviewCycle } from '../src/quality/repair.ts';
import * as documents from '../src/quality/documents.ts';
import { qualityAgentAction } from '../src/quality/agent.ts';
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'pitchcrew-quality-'));
  const context = createCrewContext(directory, 'http://127.0.0.1:4417', '/fictional/mcp.ts', true);
  cleanups.push(() => {
    context.board.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return context;
};
const correction = (
  context: ReturnType<typeof fixture>,
  cardId: string = randomUUID(),
  preference = 'Use shorter bullets',
) => {
  const record: WritingCorrection = {
    id: randomUUID(),
    cardId,
    messageId: randomUUID(),
    threadId: randomUUID(),
    instruction: 'Make these bullets shorter',
    preference,
    scope: 'resume',
    packetDigest: 'fictional',
    before: { resume: 'Original text', coverLetter: 'Letter' },
    retired: false,
    eligible: writingGuide(context).automatic,
    createdAt: new Date().toISOString(),
  };
  context.board.record('writing_correction', record, 'user', 'Fictional correction');
  return record;
};
const complete = (context: ReturnType<typeof fixture>, record: WritingCorrection) => {
  finishWritingCorrection(context, record.id, { resume: 'Short text', coverLetter: 'Letter' });
};
const planFixture = (context: ReturnType<typeof fixture>) => {
  const card = context.board.createCard({
    company: 'Fictional Labs',
    title: 'Platform engineer',
    description: 'Kubernetes operations required.',
    tags: ['target'],
    location: 'Remote',
    url: '',
    salary: '',
  });
  context.board.createCard({
    company: 'Unrelated Ltd',
    title: 'Sales manager',
    description: 'Sales forecasting.',
    tags: ['other'],
    location: 'Remote',
    url: '',
    salary: '',
  });
  const plan = qualityUserAction(context, {
    action: 'plan_create',
    name: 'Platform roles',
    scope: { tag: 'target' },
  }) as CareerPlan;
  const gap: GapInput = {
    label: 'Kubernetes',
    kind: 'evidence',
    sources: [{ cardId: card.id, requirement: 'Kubernetes operations required.' }],
    nextStep: 'Document a deployment example',
    completionCriterion: 'An example with user-verified contribution',
    rationale: 'A required capability in the selected job.',
  };
  return { card, plan, gap };
};

const cleanups: (() => void)[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe('writing guide learning and provenance', () => {
  it('requires independent applications and records examples once', () => {
    const context = fixture();
    const first = correction(context);
    complete(context, first);
    complete(context, first);
    expect(writingGuide(context).preferences).toHaveLength(0);
    const repeated = correction(context, first.cardId);
    complete(context, repeated);
    expect(writingGuide(context).preferences).toHaveLength(0);
    const second = correction(context);
    complete(context, second);
    expect(writingGuide(context).preferences[0]).toMatchObject({
      origin: 'learned',
      enabled: true,
      scope: 'resume',
    });
    expect(writingGuide(context).preferences[0].correctionIds).toContain(second.id);
  });
  it('does not learn from unchanged output or while automatic learning is off', () => {
    const context = fixture();
    const first = correction(context);
    finishWritingCorrection(context, first.id, first.before);
    const second = correction(context);
    complete(context, second);
    expect(writingGuide(context).preferences).toHaveLength(0);
    const guide = writingGuide(context);
    qualityUserAction(context, { action: 'learning', revision: guide.revision, automatic: false });
    const third = correction(context);
    complete(context, third);
    expect(writingGuide(context).preferences).toHaveLength(0);
  });
  it('Undo retires evidence; Disable survives more matching corrections and restart', () => {
    const context = fixture();
    complete(context, correction(context));
    complete(context, correction(context));
    let guide = writingGuide(context);
    const original = guide.preferences[0];
    qualityUserAction(context, {
      action: 'preference_state',
      revision: guide.revision,
      id: original.id,
      operation: 'undo',
    });
    expect(writingGuide(context).preferences).toHaveLength(0);
    complete(context, correction(context));
    expect(writingGuide(context).preferences).toHaveLength(0);
    complete(context, correction(context));
    guide = writingGuide(context);
    expect(guide.preferences).toHaveLength(1);
    qualityUserAction(context, {
      action: 'preference_state',
      revision: guide.revision,
      id: guide.preferences[0].id,
      operation: 'disable',
    });
    complete(context, correction(context));
    context.board.rebuild();
    expect(writingGuide(context).preferences[0].enabled).toBe(false);
    expect(
      context.board.list<WritingCorrection>('writing_correction').filter((c) => c.retired),
    ).toHaveLength(2);
  });
  it('keeps explicit preferences and rejects stale guide edits', () => {
    const context = fixture();
    const guide = writingGuide(context);
    qualityUserAction(context, {
      action: 'preference',
      revision: guide.revision,
      text: 'Use shorter bullets',
      scope: 'resume',
    });
    complete(context, correction(context));
    complete(context, correction(context));
    expect(writingGuide(context).preferences).toHaveLength(1);
    expect(writingGuide(context).preferences[0].origin).toBe('explicit');
    expect(() =>
      qualityUserAction(context, {
        action: 'learning',
        revision: guide.revision,
        automatic: false,
      }),
    ).toThrow('changed');
  });
});

it('requires user adoption of critic proposals and rejects proposals against a changed guide', async () => {
  const context = fixture();
  const run: Run = {
    id: randomUUID(),
    roleId: 'pipeline-coach',
    cardId: null,
    runtime: 'demo',
    status: 'running',
    message: 'Critique',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    mode: 'chat',
    threadId: randomUUID(),
  };
  context.board.record('run', run, 'system', 'Fictional critique');
  const capability = { runId: run.id, roleId: run.roleId, cardId: null };
  const proposed = await qualityAgentAction(context, capability, {
    action: 'writing_propose',
    revision: writingGuide(context).revision,
    text: 'Prefer concrete openings',
    scope: 'all',
    reason: 'Repeated generic introductions obscure the strongest evidence.',
  });
  expect(writingGuide(context).preferences).toHaveLength(0);
  const id = (proposed.proposal as { id: string }).id;
  const guide = writingGuide(context);
  qualityUserAction(context, {
    action: 'proposal_decision',
    revision: guide.revision,
    id,
    approved: true,
  });
  expect(writingGuide(context).preferences[0]).toMatchObject({
    text: 'Prefer concrete openings',
    origin: 'explicit',
  });
  const stale = await qualityAgentAction(context, capability, {
    action: 'writing_propose',
    revision: writingGuide(context).revision,
    text: 'Use short paragraphs',
    scope: 'coverLetter',
    reason: 'Improve scanning.',
  });
  qualityUserAction(context, {
    action: 'preference',
    revision: writingGuide(context).revision,
    text: 'Keep technical names exact',
    scope: 'all',
  });
  expect(() =>
    qualityUserAction(context, {
      action: 'proposal_decision',
      revision: writingGuide(context).revision,
      id: (stale.proposal as { id: string }).id,
      approved: true,
    }),
  ).toThrow('fresh critique');
  await expect(
    qualityAgentAction(
      context,
      { ...capability, roleId: 'writer' },
      {
        action: 'writing_propose',
        revision: writingGuide(context).revision,
        text: 'Unapproved opinion',
        scope: 'all',
        reason: 'Opinion',
      },
    ),
  ).rejects.toThrow('permission');
});

describe('scoped persistent career action plans', () => {
  it('uses only selected jobs and validates actual source requirements', () => {
    const context = fixture();
    const { card, plan, gap } = planFixture(context);
    expect(planCards(context, plan).map((c) => c.id)).toEqual([card.id]);
    const sourceRevision = planRevision(context, plan, []);
    expect(() =>
      refreshPlan(
        context,
        plan,
        [{ ...gap, sources: [{ cardId: card.id, requirement: 'Invented requirement' }] }],
        [],
        sourceRevision,
        'Complete',
      ),
    ).toThrow('exact requirement');
    const saved = refreshPlan(context, plan, [gap], [], sourceRevision, '1 selected job examined.');
    expect(saved.gaps[0].kind).toBe('evidence');
    expect(() =>
      refreshPlan(context, plan, [{ ...gap, kind: 'skill' }], [], sourceRevision, 'Complete'),
    ).toThrow('user confirms');
  });
  it('requires user confirmation for skill gaps and preserves priorities/progress on refresh', () => {
    const context = fixture();
    const { plan, gap } = planFixture(context);
    let current = refreshPlan(
      context,
      plan,
      [gap],
      [],
      planRevision(context, plan, []),
      'Complete',
    );
    const id = current.gaps[0].id;
    current = qualityUserAction(context, {
      action: 'plan_gap_kind',
      id: current.id,
      revision: current.revision,
      gapId: id,
      kind: 'skill',
    }) as CareerPlan;
    current = qualityUserAction(context, {
      action: 'plan_priorities',
      id: current.id,
      revision: current.revision,
      gapIds: [id],
    }) as CareerPlan;
    current = qualityUserAction(context, {
      action: 'plan_progress',
      id: current.id,
      revision: current.revision,
      gapId: id,
      progress: 'completed',
    }) as CareerPlan;
    const saved = refreshPlan(
      context,
      current,
      [],
      [],
      planRevision(context, current, []),
      'No remaining observed gap.',
    );
    expect(saved.gaps[0]).toMatchObject({
      active: true,
      progress: 'completed',
      supportedInLatestAnalysis: false,
    });
    context.board.rebuild();
    expect(currentPlan(context, plan.id).gaps[0].progress).toBe('completed');
  });
  it('marks changed sources/Profile stale and rejects stale refresh revisions', () => {
    const context = fixture();
    const { card, plan, gap } = planFixture(context);
    const sourceRevision = planRevision(context, plan, []);
    refreshPlan(context, plan, [gap], [], sourceRevision, 'Complete');
    expect(qualitySnapshot(context, []).careerPlans[0].stale).toBe(false);
    expect(
      qualitySnapshot(context, [{ name: 'new.md', content: 'New verified experience.' }])
        .careerPlans[0].stale,
    ).toBe(true);
    context.board.record(
      'card',
      { ...card, description: 'Changed requirements.' },
      'user',
      'Changed source',
    );
    expect(() =>
      refreshPlan(context, currentPlan(context, plan.id), [gap], [], sourceRevision, 'Complete'),
    ).toThrow('Source jobs');
  });
  it('requires separate mutation permission and genuine user progress sources', async () => {
    const context = fixture();
    const { plan, gap } = planFixture(context);
    const saved = refreshPlan(
      context,
      plan,
      [gap],
      [],
      planRevision(context, plan, []),
      'Complete',
    );
    const threadId = randomUUID();
    const run: Run = {
      id: randomUUID(),
      roleId: 'career-coach',
      cardId: null,
      runtime: 'demo',
      status: 'running',
      message: 'Testing',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      mode: 'chat',
      threadId,
    };
    context.board.record('run', run, 'system', 'Fictional run');
    context.controllers.set(run.id, new AbortController());
    const capability = { runId: run.id, roleId: run.roleId, cardId: null };
    const hypothetical = context.addMessage(
      threadId,
      'user',
      'career-coach',
      'I might finish the course next week.',
      null,
      null,
    );
    await expect(
      qualityAgentAction(context, capability, {
        action: 'plan_progress',
        id: saved.id,
        revision: saved.revision,
        gapId: saved.gaps[0].id,
        progress: 'completed',
        messageId: hypothetical.id,
        quote: hypothetical.content,
      }),
    ).rejects.toThrow('tentative');
    const message = context.addMessage(
      threadId,
      'user',
      'career-coach',
      'I finished the Kubernetes course.',
      null,
      null,
    );
    await qualityAgentAction(context, capability, {
      action: 'plan_progress',
      id: saved.id,
      revision: saved.revision,
      gapId: saved.gaps[0].id,
      progress: 'completed',
      messageId: message.id,
      quote: message.content,
    });
    expect(currentPlan(context, plan.id).gaps[0].progressSource?.messageId).toBe(message.id);
    const role = context.board.get<import('@pitchcrew/core').Role>('role', 'career-coach');
    context.board.record(
      'role',
      { ...role, capabilities: { ...role.capabilities!, manageCareerPlans: false } },
      'user',
      'Revoked mutation',
    );
    await expect(
      qualityAgentAction(context, capability, {
        action: 'plan_refresh',
        id: saved.id,
        revision: currentPlan(context, plan.id).revision,
        sourceRevision: planRevision(context, saved, []),
        gaps: [gap],
        coverage: 'Complete',
      }),
    ).rejects.toThrow('management');
    expect(
      (await qualityAgentAction(context, capability, { action: 'plans_read' })).plans,
    ).toBeDefined();
  });
});

it('retains the one-correction limit across a question continuation in the same application chain', async () => {
  const context = fixture();
  const { card } = planFixture(context);
  const { packet } = await import('../../board/test/fixtures/packet.ts');
  context.board.record(
    'card',
    { ...card, packet, state: 'in_review' },
    'system',
    'Fictional continuation packet',
  );
  const rootRunId = randomUUID();
  const parent: Run = {
    id: randomUUID(),
    rootRunId,
    cardId: card.id,
    roleId: 'reviewer',
    runtime: 'demo',
    mode: 'workflow',
    purpose: 'application-review',
    status: 'running',
    message: 'Continued review',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  context.board.record(
    'run',
    { ...parent, id: randomUUID(), documentRepair: true, status: 'completed' },
    'system',
    'Earlier correction in this chain',
  );
  context.board.record('run', parent, 'system', 'Continued after user answer');
  vi.spyOn(documents, 'inspectPacketDocuments').mockResolvedValue({
    reports: [],
    errors: [],
    warnings: ['Review the page preview.'],
    repairable: ['Possible stranded heading'],
  });
  const before = context.board.list<Run>('run').length;
  await documentReviewCycle(context, parent, [], new AbortController().signal);
  expect(context.board.list<Run>('run')).toHaveLength(before);
  expect(context.board.get<import('@pitchcrew/core').Card>('card', card.id).feedback).toContain(
    'Warning: Review the page preview.',
  );
});
