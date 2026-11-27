import { describe, expect, it } from 'vitest';
import type { FormAssessment, Snapshot, WorkQueueView } from '@pitchcrew/core';
import { profileProposalLifecycle } from '@pitchcrew/core/lifecycles';
import { queueAttention } from '@/QueueWidget/helpers.ts';
import {
  attentionCounts,
  attentionItems,
  attentionOrder,
  cachedAttention,
  recoveryQueue,
  type AttentionItem,
} from '../attention.ts';
import { pendingInstructionUpdates } from '../instruction-updates.ts';
import { pendingSkillUpdates } from '../skill-updates.ts';
import {
  ago,
  attempt,
  brief,
  browserApproval,
  card,
  confirmed,
  delivery,
  everyKind,
  everyKindRemote,
  instructionUpdate,
  pendingPacket,
  profileProposal,
  question,
  queue,
  remote,
  request,
  roleProposal,
  run,
  signal,
  skill,
  skillCheck,
  skillProposal,
  snapshot,
  task,
} from './attention-fixture.ts';
import { busySnapshot } from './busy-fixture.ts';

const items = (data: Snapshot, remoteRequests = everyKindRemote) =>
  attentionItems(data, { remoteRequests });
const keys = (data: Snapshot) => attentionItems(data).map((item) => item.key);
const byKey = (data: Snapshot, key: string, remoteRequests = everyKindRemote) =>
  items(data, remoteRequests).find((item) => item.key === key);
const withFields = (fields: Partial<Snapshot>) => ({ ...everyKind(), ...fields });
const queues = (...list: WorkQueueView[]) => ({
  concurrency: 5,
  active: 0,
  background: 0,
  queues: list,
});

describe('attention items', () => {
  it('lists all 17 kinds, ranked by tier, expiry, age and key', () => {
    const list = items(everyKind());
    expect(new Set(list.map((item) => item.kind)).size).toBe(17);
    expect(list.map((item) => item.key)).toEqual([
      // Tier 1: the connection expires in 8 minutes, the browser run in about 12; recovery never.
      'connection:remote-1',
      'browser:approval-1',
      'profile-recovery:profile-2',
      // Tier 2, oldest first.
      'failure:job:corvid',
      'verify:attempt-1',
      'blocked:conversation:t-prep',
      'question:question-1',
      'brief:quill',
      'packet:packet-1',
      'export:halyard',
      'tracking:signal-1',
      'instruction-update:scout',
      'writing-suggestion:writing-1',
      'profile-proposal:profile-1',
      'role-proposal:proposal-1',
      'skill-proposal:skill-proposal-1',
      'skill-update:skill-1',
    ]);
  });

  it('fills each kind from its record', () => {
    const data = everyKind();
    const list = items(data);
    const get = (key: string) => list.find((item) => item.key === key);
    expect(get('browser:approval-1')).toMatchObject({
      tier: 1,
      cardId: 'initech',
      roleId: 'submitter',
      threadId: 't-initech',
      queueId: 'job:initech',
      askedAt: ago(4),
      // Run start plus the 30-minute run limit.
      expiresAt: ago(-12),
      holdsSlot: true,
      blocks: 'run',
      tone: 'ochre',
      decides: 'in-place',
      verbs: ['approve', 'reject', 'details'],
    });
    expect(get('connection:remote-1')).toMatchObject({
      tier: 1,
      expiresAt: ago(-8),
      name: 'Fictional Desktop',
      decides: 'page',
      verbs: ['review-in-settings'],
    });
    expect(get('profile-recovery:profile-2')).toMatchObject({
      askedAt: ago(30),
      blocks: 'crew',
      verbs: ['review-on-profile'],
    });
    expect(get('question:question-1')).toMatchObject({
      tier: 2,
      cardId: 'umbra',
      roleId: 'writer',
      threadId: 't-umbra',
      queueId: 'job:umbra',
      blocks: 'queue',
      verbs: ['answer', 'cancel', 'open-conversation'],
    });
    expect(get('failure:job:corvid')).toMatchObject({
      entityId: 'job:corvid',
      roleId: 'scout',
      queueId: 'job:corvid',
      // The stopped delivery's run finished then, not when the queue was last written.
      askedAt: ago(50),
      tone: 'rose',
      reason: 'Scout stopped.',
      verbs: ['retry', 'skip'],
    });
    expect(get('verify:attempt-1')).toMatchObject({
      cardId: 'fathom',
      roleId: 'submitter',
      threadId: 't-fathom',
      blocks: 'browser',
      decides: 'form',
      verbs: ['verify-in-job'],
    });
    expect(get('blocked:conversation:t-prep')).toMatchObject({
      cardId: null,
      roleId: 'writer',
      threadId: 't-prep',
      askedAt: ago(35),
      reason: 'Install the assigned runtime in Settings.',
      decides: 'page',
      verbs: ['open-conversation', 'open-queue'],
    });
    expect(get('packet:packet-1')).toMatchObject({
      tier: 3,
      stage: 'approve',
      roleId: null,
      askedAt: ago(70),
      verbs: ['approve-packet', 'request-changes', 'reject-packet', 'not-applying'],
    });
    expect(get('brief:quill')).toMatchObject({ tier: 3, blocks: 'none', queueId: null });
    expect(get('export:halyard')).toMatchObject({
      roleId: 'reviewer',
      askedAt: ago(40),
      decides: 'form',
      verbs: ['request-export'],
    });
    expect(get('tracking:signal-1')).toMatchObject({
      tier: 4,
      cardId: 'bluefin',
      roleId: 'tracker',
    });
    expect(get('role-proposal:proposal-1')).toMatchObject({
      tier: 5,
      roleId: 'writer',
      targetId: 'writer',
      threadId: 'writer',
      verbs: ['apply-changes', 'decline'],
    });
    expect(get('skill-proposal:skill-proposal-1')).toMatchObject({
      roleId: 'reviewer',
      targetId: 'Cover letter openings',
      threadId: 't-crew',
    });
    expect(get('instruction-update:scout')).toMatchObject({
      targetId: 'scout',
      askedAt: '2026-11-10T00:00:00.000Z',
      decides: 'page',
    });
    expect(get('skill-update:skill-1')).toMatchObject({ targetId: 'skill-1', askedAt: ago(80) });
    expect(get('writing-suggestion:writing-1')).toMatchObject({
      roleId: 'writer',
      askedAt: ago(500),
      verbs: ['apply-suggestion', 'dismiss'],
    });
    expect(get('profile-proposal:profile-1')).toMatchObject({ tier: 5, decides: 'page' });
  });

  it('asks only for pending browser approvals the user was asked for', () => {
    const data = withFields({
      computerApprovals: [
        browserApproval('approved', { status: 'approved' }),
        browserApproval('automatic', { automatic: true }),
        browserApproval('rejected', { status: 'rejected' }),
      ],
    });
    expect(keys(data).filter((key) => key.startsWith('browser:'))).toEqual([]);
    // A request whose run already ended still waits, but holds no slot and has no clock.
    const ended = withFields({
      runs: [run('run-submit', { cardId: 'initech', status: 'completed', finishedAt: ago(1) })],
    });
    expect(byKey(ended, 'browser:approval-1')).toMatchObject({ holdsSlot: false, expiresAt: null });
  });

  it('lists connection requests only from outside the snapshot', () => {
    expect(keys(everyKind()).some((key) => key.startsWith('connection:'))).toBe(false);
    expect(byKey(everyKind(), 'connection:remote-2', [remote('remote-2')])?.tier).toBe(1);
  });

  it('separates Profile recovery from Profile updates to review', () => {
    const data = withFields({
      profileProposals: [
        profileProposal('applied', { status: 'applied' }),
        profileProposal('rejected', { status: 'rejected' }),
      ],
    });
    expect(keys(data).filter((key) => key.startsWith('profile'))).toEqual([]);
  });

  it('lists pending questions, with or without a job', () => {
    const data = withFields({
      userInputs: [
        question('answered', { status: 'answered' }),
        question('cancelled', { status: 'cancelled' }),
        question('free', { cardId: null, threadId: 't-prep', sourceThreadId: 't-prep' }),
      ],
    });
    expect(keys(data).filter((key) => key.startsWith('question:'))).toEqual(['question:free']);
    expect(byKey(data, 'question:free')?.queueId).toBe('conversation:t-prep');
  });

  it('finds failed and interrupted lanes that are not executing', () => {
    const failed = queue('job:a', { paused: true, pauseKind: 'failed', state: 'waiting' });
    expect(recoveryQueue(failed)).toBe(true);
    expect(recoveryQueue({ ...failed, state: 'running' })).toBe(false);
    expect(recoveryQueue({ ...failed, pauseKind: 'user', state: 'paused' })).toBe(false);
    const data = snapshot({
      cards: [card('a'), card('b'), card('c'), card('d')],
      queue: queues(
        // A question in a lane paused as failed reports `waiting`, and the failure still shows.
        failed,
        queue('job:b', { paused: true, pauseKind: 'failed', state: 'running' }),
        queue('job:c', { paused: true, pauseKind: 'user', state: 'paused' }),
        queue('job:d', { paused: true, pauseKind: 'interrupted', state: 'paused' }),
      ),
    });
    expect(attentionItems(data).map((item) => [item.key, item.tone])).toEqual([
      // Neither lane has a request or run time, so both sort last by key.
      ['failure:job:a', 'rose'],
      ['failure:job:d', 'ochre'],
    ]);
  });

  it('dates a failed follow-up by its run and names its agent', () => {
    const data = snapshot({
      runs: [run('run-follow', { status: 'failed', finishedAt: ago(15) })],
      queue: queues(
        queue('conversation:t-1', {
          paused: true,
          pauseKind: 'failed',
          state: 'paused',
          tasks: [
            task('task-1', {
              status: 'failed',
              runId: 'run-follow',
              roleId: 'reviewer',
              error: 'No page.',
            }),
          ],
        }),
      ),
    });
    expect(attentionItems(data)[0]).toMatchObject({
      roleId: 'reviewer',
      askedAt: ago(15),
      reason: 'No page.',
    });
  });

  it('keeps failure and hold ages when another queue moves', () => {
    const data = everyKind();
    const before = items(data).map((item) => [item.key, item.askedAt]);
    const moved = {
      ...data,
      queue: {
        ...data.queue!,
        queues: data.queue!.queues.map((entry, index) => ({
          ...entry,
          order: 100 - index,
          updatedAt: ago(-1),
        })),
      },
    };
    expect(items(moved).map((item) => [item.key, item.askedAt])).toEqual(before);
  });

  it('verifies uncertain submissions whatever the job status, never as a packet stage', () => {
    const awaiting = card('juniper', {
      company: 'Juniper',
      state: 'awaiting_approval',
      submissionAttempts: [attempt('attempt-2', 'juniper', { exportApprovalId: 'packet-1' })],
      packet: everyKind().cards.find((entry) => entry.id === 'juniper')!.packet,
    });
    const data = withFields({
      cards: [...everyKind().cards.filter((entry) => entry.id !== 'juniper'), awaiting],
      approvals: [
        pendingPacket('packet-1', 'juniper', { status: 'approved', packet: awaiting.packet! }),
      ],
    });
    expect(keys(data)).toContain('verify:attempt-2');
    expect(keys(data)).not.toContain('packet:packet-1');
    // A status correction does not settle it.
    expect(keys(everyKind())).toContain('verify:attempt-1');
    const confirmedAttempt = withFields({
      cards: everyKind().cards.map((entry) =>
        entry.id === 'fathom'
          ? {
              ...entry,
              submissionAttempts: [attempt('attempt-1', 'fathom', { status: 'confirmed' })],
            }
          : entry,
      ),
    });
    expect(keys(confirmedAttempt)).not.toContain('verify:attempt-1');
  });
});

describe('blocked queues', () => {
  const held = (reason: string, cardId = 'quill', action: 'draft' | 'fit' = 'draft') =>
    queue(`job:${cardId}`, {
      state: 'blocked',
      reason,
      requests: [
        request(`r-${cardId}`, { boardAction: action, deliveries: [delivery('writer', 'queued')] }),
      ],
    });
  const briefHold = 'Review and confirm this job’s application brief before drafting.';

  it('drops a hold only when its fixed message is explained by another item', () => {
    const shortlisted = card('quill', {
      company: 'Quill',
      state: 'shortlisted',
      applicationContext: brief(),
    });
    const explained = snapshot({ cards: [shortlisted], queue: queues(held(briefHold)) });
    expect(keys(explained)).toEqual(['brief:quill']);
    // With the brief confirmed there is no brief item, so the hold shows with its reason.
    const unexplained = snapshot({
      cards: [{ ...shortlisted, applicationContext: confirmed() }],
      queue: queues(held(briefHold)),
    });
    expect(keys(unexplained)).toEqual(['blocked:job:quill']);
    expect(attentionItems(unexplained)[0]?.reason).toBe(briefHold);
  });

  it('keeps a runtime hold beside the brief that also holds the draft', () => {
    const data = snapshot({
      cards: [card('quill', { state: 'shortlisted', applicationContext: brief() })],
      queue: queues(held('Install the assigned runtime in Settings.')),
    });
    // The brief was extracted before the draft was queued, so it is the older ask.
    expect(keys(data)).toEqual(['brief:quill', 'blocked:job:quill']);
    expect(attentionItems(data).find((item) => item.kind === 'brief')).toMatchObject({
      tier: 2,
      blocks: 'queue',
    });
  });

  it('drops the verify and Profile holds only beside their items', () => {
    const verifyHold = 'Verify the previous submission outcome first.';
    const submitted = card('fathom', {
      state: 'awaiting_approval',
      submissionAttempts: [attempt('a1', 'fathom')],
    });
    expect(
      keys(snapshot({ cards: [submitted], queue: queues(held(verifyHold, 'fathom')) })),
    ).toEqual(['verify:a1']);
    expect(
      keys(snapshot({ cards: [card('fathom')], queue: queues(held(verifyHold, 'fathom')) })),
    ).toEqual(['blocked:job:fathom']);
    const profileHold =
      'Finish the approved profile update on Profile before starting runs or editing notes.';
    const recovering = snapshot({
      cards: [card('lead')],
      profileProposals: [profileProposal('p', { status: 'applying' })],
      queue: queues(held(profileHold, 'lead', 'fit')),
    });
    expect(keys(recovering)).toEqual(['profile-recovery:p']);
    // Short self-resolving holds stay, worded by the server.
    const saving = snapshot({
      cards: [card('lead')],
      queue: queues(held('Agent settings are being updated.', 'lead', 'fit')),
    });
    expect(keys(saving)).toEqual(['blocked:job:lead']);
  });
});

describe('packets', () => {
  const awaiting = (fields = {}) =>
    card('juniper', {
      company: 'Juniper',
      state: 'awaiting_approval',
      packet: null,
      url: 'https://x.example/apply',
      ...fields,
    });
  const one = (approval: ReturnType<typeof pendingPacket>, extra: Partial<Snapshot> = {}) =>
    attentionItems(snapshot({ cards: [awaiting()], approvals: [approval], ...extra })).filter(
      (item) => item.kind === 'packet',
    );

  it('words every stage that waits on the user', () => {
    expect(one(pendingPacket('p', 'juniper'))[0]).toMatchObject({ stage: 'approve' });
    expect(
      one(pendingPacket('p', 'juniper', { status: 'approved', decidedAt: ago(20) }))[0],
    ).toMatchObject({
      stage: 'choose',
      askedAt: ago(20),
      verbs: ['agent-prepare', 'export-manual', 'not-applying'],
    });
    expect(
      one(
        pendingPacket('p', 'juniper', {
          status: 'consumed',
          submission: { method: 'manual' },
          exportDirectory: '/fictional/exports',
          decidedAt: ago(10),
        }),
      )[0],
    ).toMatchObject({
      stage: 'apply',
      verbs: ['record-submitted', 'open-application', 'not-applying'],
    });
  });

  it('offers no application to open without a posting link', () => {
    const exported = pendingPacket('p', 'juniper', {
      status: 'consumed',
      submission: { method: 'manual' },
      exportDirectory: '/fictional/exports',
      decidedAt: ago(10),
    });
    const [item] = attentionItems(
      snapshot({ cards: [awaiting({ url: '' })], approvals: [exported] }),
    );
    expect(item).toMatchObject({ stage: 'apply', verbs: ['record-submitted', 'not-applying'] });
  });

  it('lists preparation only once no agent will move it', () => {
    const prepared = (
      status?: 'queued' | 'running' | 'waiting' | 'completed' | 'cancelled' | 'paused' | 'failed',
      pauseKind?: 'user' | 'failed',
    ) => {
      const approval = pendingPacket('p', 'juniper', {
        status: 'consumed',
        submission: { method: 'agent', roleId: 'submitter', threadId: 't-sub', requestId: 'req' },
        decidedAt: ago(30),
      });
      const chat = status
        ? request('req', { deliveries: [delivery('submitter', status)] })
        : undefined;
      return one(approval, {
        chatRequests: chat ? [chat] : [],
        queue: queues(
          queue('job:juniper', {
            paused: !!pauseKind,
            pauseKind,
            state: pauseKind ? 'paused' : 'ready',
            requests: chat && status !== 'completed' && status !== 'cancelled' ? [chat] : [],
          }),
        ),
      });
    };
    expect(prepared()[0]).toMatchObject({
      stage: 'preparing',
      roleId: 'submitter',
      threadId: 't-sub',
    });
    expect(prepared('completed')).toHaveLength(1);
    expect(prepared('cancelled')).toHaveLength(1);
    // Stop pauses the lane as the user's own: Decisions still lists it, and so does Home.
    expect(prepared('paused', 'user')).toHaveLength(1);
    // Moving preparation is crew work; waiting is a question; failed is a failure item.
    expect(prepared('queued')).toHaveLength(0);
    expect(prepared('running')).toHaveLength(0);
    expect(prepared('waiting')).toHaveLength(0);
    expect(prepared('failed', 'failed')).toHaveLength(0);
    expect(prepared('paused', 'failed')).toHaveLength(0);
  });

  it('ignores rejected packets and jobs that left approval', () => {
    expect(one(pendingPacket('p', 'juniper', { status: 'rejected' }))).toEqual([]);
    expect(
      attentionItems(
        snapshot({
          cards: [awaiting({ state: 'agreed' })],
          approvals: [pendingPacket('p', 'juniper')],
        }),
      ).filter((item) => item.kind === 'packet'),
    ).toEqual([]);
  });
});

describe('briefs', () => {
  const draftQueue = (state: WorkQueueView['state'], reason = '') =>
    queue('job:quill', {
      state,
      reason,
      requests: [
        request('draft', { boardAction: 'draft', deliveries: [delivery('writer', 'queued')] }),
      ],
    });
  const quill = (fields = {}) =>
    card('quill', { state: 'shortlisted', applicationContext: brief(), ...fields });

  it('asks only in the preparing statuses', () => {
    for (const state of ['lead', 'submitted', 'withdrawn'] as const)
      expect(keys(snapshot({ cards: [quill({ state })] }))).toEqual([]);
    for (const state of [
      'shortlisted',
      'drafting',
      'changes_requested',
      'in_review',
      'agreed',
      'awaiting_approval',
    ] as const)
      expect(keys(snapshot({ cards: [quill({ state })] }))).toEqual(['brief:quill']);
    expect(keys(snapshot({ cards: [quill({ applicationContext: confirmed() })] }))).toEqual([]);
    expect(keys(snapshot({ cards: [quill({ applicationContext: undefined })] }))).toEqual([]);
  });

  it('asks for a missing or stale form and for missing answers on a confirmed brief', () => {
    const url = 'https://quill.example/apply';
    // A linked application with neither an inspected form nor the user's manual-check choice.
    const linked = quill({ url, applicationContext: confirmed() });
    expect(keys(snapshot({ cards: [linked] }))).toEqual(['brief:quill']);
    const field = (label: string) => ({
      label,
      type: 'text',
      required: true,
      visible: true,
      disabled: false,
      accept: '',
      options: [],
      assessed: true,
      condition: '',
      missingAnswer: '',
    });
    const inspection = (labels: string[], minutes: number): FormAssessment => ({
      id: `inspection-${minutes}`,
      cardId: 'quill',
      roleId: 'submitter',
      runId: 'run-inspect',
      page: { url, title: 'Apply', text: '', digest: 'page' },
      fields: labels.map((label) => ({ ...field(label), selector: `#${label.toLowerCase()}` })),
      blockers: [],
      uninspected: [],
      createdAt: ago(minutes),
    });
    const form = {
      status: 'inspected' as const,
      url,
      fields: [field('Name')],
      blockers: [],
      uninspected: [],
    };
    const adopted = quill({
      url,
      applicationContext: confirmed({ form }),
      formAssessments: [inspection(['Name'], 60)],
    });
    expect(keys(snapshot({ cards: [adopted] }))).toEqual([]);
    // A newer inspection found a required field the confirmed brief never saw.
    const stale = {
      ...adopted,
      formAssessments: [inspection(['Name'], 60), inspection(['Name', 'Portfolio'], 5)],
    };
    expect(attentionItems(snapshot({ cards: [stale] }))).toMatchObject([
      { key: 'brief:quill', tier: 3 },
    ]);
    const answers = quill({
      applicationContext: confirmed({
        requirements: [
          { id: 'why', question: 'Why this role?', required: true, personal: true, answer: '' },
        ],
      }),
    });
    expect(keys(snapshot({ cards: [answers] }))).toEqual(['brief:quill']);
  });

  it('promotes a brief that holds a queued draft, even while every slot is busy', () => {
    // The drain skips a queue without a reason while no slot is free: it stays ready.
    const waiting = snapshot({
      cards: [quill()],
      queue: { ...queues(draftQueue('ready')), active: 5 },
    });
    expect(attentionItems(waiting)[0]).toMatchObject({
      kind: 'brief',
      tier: 2,
      blocks: 'queue',
      queueId: 'job:quill',
    });
    const blocked = snapshot({
      cards: [quill()],
      queue: queues(
        draftQueue('blocked', 'Review and confirm this job’s application brief before drafting.'),
      ),
    });
    expect(attentionItems(blocked).map((item) => [item.key, item.tier])).toEqual([
      ['brief:quill', 2],
    ]);
  });

  it('promotes only for a queued action that checks the confirmed brief', () => {
    // Reevaluating needs only the extracted brief, as fit does, so it never waits on confirming it.
    const reevaluate = queue('job:quill', {
      state: 'ready',
      requests: [
        request('again', { boardAction: 'reevaluate', deliveries: [delivery('scout', 'queued')] }),
      ],
    });
    const reviewed = quill({ state: 'in_review', packet: { resume: 'r' } as never });
    const data = snapshot({ cards: [reviewed], queue: queues(reevaluate) });
    expect(attentionItems(data)).toMatchObject([
      { key: 'brief:quill', tier: 3, blocks: 'none', queueId: null },
    ]);
  });

  it('never promotes a brief that misses only answers', () => {
    const answers = quill({
      applicationContext: confirmed({
        requirements: [{ id: 'why', question: 'Why?', required: true, personal: true, answer: '' }],
      }),
    });
    const data = snapshot({ cards: [answers], queue: queues(draftQueue('ready')) });
    expect(attentionItems(data)[0]).toMatchObject({ kind: 'brief', tier: 3, blocks: 'none' });
  });
});

describe('exports', () => {
  const reviewed = (fields = {}) =>
    card('halyard', {
      state: 'agreed',
      packet: { resume: 'r' } as never,
      applicationContext: confirmed(),
      packetReview: {
        contextRevision: 'brief-1',
        packetDigest: 'd',
        runId: 'run-review',
        reviewedAt: ago(40),
      },
      ...fields,
    });
  const exports = (data: Partial<Snapshot>) =>
    attentionItems(
      snapshot({ runs: [run('run-review', { roleId: 'reviewer', status: 'completed' })], ...data }),
    )
      .filter((item) => item.kind === 'export')
      .map((item) => item.roleId);

  it('asks to export a reviewed packet at rest, naming the Reviewer', () => {
    expect(exports({ cards: [reviewed()] })).toEqual(['reviewer']);
    // Without the review's run the agent is unknown.
    expect(
      attentionItems(snapshot({ cards: [reviewed()] })).find((item) => item.kind === 'export')
        ?.roleId,
    ).toBeNull();
  });

  it('never asks while the server would refuse or the crew still works', () => {
    // A brief changed since the review: crew work, not the user's move.
    expect(
      exports({
        cards: [
          reviewed({
            packetReview: {
              contextRevision: 'old',
              packetDigest: 'd',
              runId: 'run-review',
              reviewedAt: ago(40),
            },
          }),
        ],
      }),
    ).toEqual([]);
    // Missing answers are the brief's item, not an export.
    const answers = reviewed({
      applicationContext: confirmed({
        requirements: [{ id: 'why', question: 'Why?', required: true, personal: true, answer: '' }],
      }),
    });
    expect(keys(snapshot({ cards: [answers] }))).toEqual(['brief:halyard']);
    expect(exports({ cards: [reviewed({ owner: 'writer' })] })).toEqual([]);
    expect(
      exports({
        cards: [reviewed()],
        runs: [run('busy', { cardId: 'halyard', status: 'running' })],
      }),
    ).toEqual([]);
    expect(
      exports({
        cards: [reviewed()],
        queue: queues(
          queue('job:halyard', {
            requests: [
              request('again', {
                boardAction: 'review',
                deliveries: [delivery('reviewer', 'queued')],
              }),
            ],
          }),
        ),
      }),
    ).toEqual([]);
    // The user just rejected this exact packet.
    expect(
      exports({
        cards: [reviewed()],
        approvals: [
          pendingPacket('old', 'halyard', { status: 'rejected', packet: { resume: 'r' } as never }),
        ],
      }),
    ).toEqual([]);
  });

  it('survives a job without a review and a queue without requests', () => {
    const data = snapshot({
      cards: [reviewed({ packetReview: undefined })],
      queue: queues(
        queue('job:halyard', { state: 'paused', paused: true, pauseKind: 'interrupted' }),
      ),
    });
    expect(() => attentionItems(data)).not.toThrow();
    expect(attentionItems(data).map((item) => [item.key, item.askedAt])).toEqual([
      ['failure:job:halyard', ''],
    ]);
  });
});

describe('the other kinds', () => {
  it('reads tracking candidates, crew changes and updates only while pending', () => {
    const data = snapshot({
      cards: [card('a'), card('b')],
      trackingSignals: [
        signal('two', { candidateIds: ['a', 'b'] }),
        signal('done', { status: 'applied' }),
      ],
      proposals: [
        roleProposal('from-coach', { roleId: 'scout', sourceRoleId: 'pipeline-coach' }),
        roleProposal('applied', { status: 'applied' }),
      ],
      skillProposals: [skillProposal('declined', { status: 'rejected' })],
      instructionUpdates: [
        instructionUpdate('scout', { dismissed: true }),
        instructionUpdate('writer', { changes: [] }),
      ],
      skills: [skill('kept'), skill('fresh')],
      skillUpdates: {
        automatic: true,
        checking: false,
        checks: [
          skillCheck('kept', 'b', 'example/skills:openings/SKILL.md:' + 'b'.repeat(40)),
          skillCheck('fresh', 'c'),
        ],
      },
      profileProposals: [profileProposal('gone', { status: 'rejected' })],
    });
    const list = attentionItems(data);
    expect(list.map((item) => item.key).toSorted()).toEqual([
      'instruction-update:writer',
      'role-proposal:from-coach',
      'skill-update:fresh',
      'tracking:two',
    ]);
    expect(list.find((item) => item.kind === 'tracking')?.cardId).toBeNull();
    expect(list.find((item) => item.kind === 'role-proposal')).toMatchObject({
      roleId: 'pipeline-coach',
      targetId: 'scout',
      threadId: 'scout',
    });
    // Without a release date the update has no age and sorts last in its tier.
    expect(list.find((item) => item.kind === 'instruction-update')?.askedAt).toBe('');
  });

  it('offers only Dismiss for a writing suggestion made against an older guide', () => {
    const data = everyKind();
    const guide = data.quality!.writingGuide;
    const stale = withFields({
      quality: { ...data.quality!, writingGuide: { ...guide, revision: 4 } },
    });
    expect(byKey(stale, 'writing-suggestion:writing-1')?.verbs).toEqual(['dismiss']);
    const gone = withFields({
      quality: {
        ...data.quality!,
        writingGuide: {
          ...guide,
          proposals: guide.proposals.map((p) => ({ ...p, status: 'applied' as const })),
        },
      },
    });
    expect(byKey(gone, 'writing-suggestion:writing-1')).toBeUndefined();
  });
});

describe('ranking', () => {
  it('orders by tier, soonest expiry in tier 1, oldest ask with unknown last, then key', () => {
    const entry = (
      key: string,
      tier: AttentionItem['tier'],
      askedAt: string,
      expiresAt: string | null = null,
    ) => ({ key, tier, askedAt, expiresAt });
    const list = [
      entry('b', 2, ''),
      entry('a', 2, ''),
      entry('c', 2, ago(5)),
      entry('d', 2, ago(50)),
      entry('e', 1, ago(1)),
      entry('f', 1, ago(90), ago(-20)),
      entry('g', 1, ago(2), ago(-5)),
      entry('h', 5, ago(999)),
    ].toSorted(attentionOrder);
    expect(list.map((item) => item.key)).toEqual(['g', 'f', 'e', 'd', 'c', 'a', 'b', 'h']);
  });

  it('keeps keys stable across snapshots', () => {
    const first = items(everyKind()).map((item) => item.key);
    expect(items(structuredClone(everyKind())).map((item) => item.key)).toEqual(first);
  });
});

describe('counts and the shared cache', () => {
  it('returns the same list while only messages or live activity change', () => {
    const data = everyKind();
    const first = cachedAttention(data, everyKindRemote);
    const streamed = {
      ...data,
      messages: [{ id: 'm1' }] as Snapshot['messages'],
      activityRuns: [run('run-submit', { activity: [] })],
    };
    expect(cachedAttention(streamed, everyKindRemote)).toBe(first);
    const answered = { ...streamed, userInputs: [] };
    const next = cachedAttention(answered, everyKindRemote);
    expect(next).not.toBe(first);
    expect(next.some((item) => item.kind === 'question')).toBe(false);
    expect(cachedAttention(answered, [])).not.toBe(next);
  });

  it('agrees with the sidebar’s Crew, Profile and Skills formulas', () => {
    const data = everyKind();
    const counts = attentionCounts(items(data));
    expect(counts.home).toBe(17);
    expect(counts.crew).toBe(
      pendingInstructionUpdates(data).length +
        data.proposals.filter((proposal) => proposal.status === 'pending').length +
        data.skillProposals.filter((proposal) => proposal.status === 'pending').length,
    );
    expect(counts.profile).toBe(
      (data.profileProposals ?? []).filter((proposal) =>
        profileProposalLifecycle.is('open', proposal.status),
      ).length,
    );
    expect(counts.skills).toBe(pendingSkillUpdates(data).length);
  });

  it('counts failed work exactly as the queue chip does', () => {
    const data = snapshot({
      cards: ['a', 'b', 'c', 'd', 'e'].map((id) => card(id)),
      queue: queues(
        queue('job:a', { paused: true, pauseKind: 'failed', state: 'waiting' }),
        queue('job:b', { paused: true, pauseKind: 'failed', state: 'paused' }),
        queue('job:c', { paused: true, pauseKind: 'interrupted', state: 'paused' }),
        queue('job:d', { paused: true, pauseKind: 'user', state: 'paused' }),
        queue('job:e', { paused: true, pauseKind: 'failed', state: 'running' }),
      ),
    });
    expect(attentionCounts(attentionItems(data)).failed).toBe(queueAttention(data.queue!).failed);
    expect(attentionCounts(attentionItems(data)).failed).toBe(2);
  });
});

describe('a busy morning', () => {
  it('ranks 20 asks across 150 jobs', () => {
    const data = busySnapshot();
    expect(data.cards).toHaveLength(150);
    const list = attentionItems(data);
    expect(list.map((item) => item.key)).toEqual([
      'browser:approval-initech',
      'failure:job:keystone',
      'brief:quill-studio',
      'brief:harbor-health',
      'question:question-plinth',
      'question:question-vantage-rail',
      'question:question-copperleaf',
      'brief:waypoint',
      'failure:job:corvid',
      'question:question-umbra-health',
      'tracking:signal-cinder',
      'tracking:signal-flint',
      'tracking:signal-fathom',
      'tracking:signal-iris',
      'tracking:signal-loom',
      'tracking:signal-marlow',
      'tracking:signal-orbital',
      'tracking:signal-bluefin',
      'role-proposal:proposal-busy',
      'role-proposal:proposal-coach',
    ]);
    // About 08:52: the Submitter run started at 08:22.
    expect(list[0]?.expiresAt).toBe('2026-11-18T08:52:00.000Z');
    expect(attentionCounts(list)).toMatchObject({ home: 20, failed: 2, crew: 2 });
  });
});
