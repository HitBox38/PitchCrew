import { expect, it } from 'vitest';
import type { Card, Run, Snapshot, UserInputRequest } from '@pitchcrew/core';
import {
  agentState,
  jobAgents,
  turnPreview,
  launchBlocker,
  packetNeedsReview,
  latestJobFailure,
  applicationRows,
  applicationBeads,
  liveApplicationSteps,
  runSection,
  leadNotes,
} from '../helpers.ts';
const run = {
  id: 'run',
  cardId: 'job',
  roleId: 'writer',
  status: 'running',
  message: 'Drafting',
  startedAt: '2026-10-20T00:00:00Z',
  mode: 'workflow',
} as Run;
const data = { roles: [{ id: 'writer', name: 'My Writer' }], runs: [run] } as Snapshot;
it('merges streamed activity, hides finished work and seat reservations, and keeps each job scoped', () => {
  const live = {
    ...run,
    activity: [
      {
        id: 'note',
        kind: 'commentary',
        label: 'Update',
        text: 'Checking the brief',
        status: 'completed',
      },
    ],
  } as Run;
  expect(jobAgents('job', { ...data, activityRuns: [live] })).toEqual([
    { name: 'My Writer', run: live },
  ]);
  expect(jobAgents('other', data)).toEqual([]);
  expect(jobAgents('job', { ...data, activityRuns: [{ ...run, status: 'completed' }] })).toEqual(
    [],
  );
  expect(jobAgents('job', { ...data, runs: [{ ...run, reviewSeatReservation: true }] })).toEqual(
    [],
  );
});
it.each(['running', 'waiting'] as const)(
  'shows the %s review worker instead of its coordinator even with an upstream root',
  (status) => {
    const parent: Run = {
      ...run,
      roleId: 'reviewer',
      id: 'parent',
      purpose: 'deep-review',
      deepReviewId: 'report',
      rootRunId: 'earlier-chat',
      status,
    };
    const child: Run = {
      ...parent,
      id: 'question-turn',
      purpose: 'application-review',
      reviewStage: 'review',
      threadId: 'job-chat',
    };
    expect(
      jobAgents('job', {
        ...data,
        runs: [parent, child],
        activityRuns: [{ ...child, message: 'Current activity' }],
      }),
    ).toEqual([{ name: 'reviewer', run: { ...child, message: 'Current activity' } }]);
    expect(
      jobAgents('job', { ...data, runs: [parent, { ...child, status: 'completed' }] }).map(
        ({ run }) => run.id,
      ),
    ).toEqual(['parent']);
    expect(
      jobAgents('job', { ...data, runs: [parent, { ...child, deepReviewId: 'another-report' }] }),
    ).toHaveLength(2);
  },
);
it('preserves independent waiting and running turns of the same role, including siblings with a shared root and report', () => {
  const waiting: Run = {
    ...run,
    id: 'waiting',
    status: 'waiting',
    rootRunId: 'upstream',
    deepReviewId: 'report',
    purpose: 'application-review',
  };
  const running: Run = { ...waiting, id: 'running', status: 'running' };
  const secondWait: Run = { ...waiting, id: 'second-wait' };
  const agents = jobAgents('job', { ...data, runs: [waiting, running, secondWait] });
  expect(agents.map(({ run }) => run.id)).toEqual(['waiting', 'running', 'second-wait']);
  expect(new Set(agents.map(({ detail }) => detail)).size).toBe(3);
  expect(
    jobAgents('job', { ...data, runs: [secondWait, running, waiting] }).find(
      ({ run }) => run.id === waiting.id,
    )?.detail,
  ).toBe(agents[0].detail);
});
it('never deduplicates separate role identities with the same display name', () => {
  const other = { ...run, id: 'other', roleId: 'another-writer', status: 'waiting' as const };
  const agents = jobAgents('job', {
    ...data,
    roles: [...data.roles, { ...data.roles[0], id: other.roleId }],
    runs: [run, other],
  });
  expect(agents.map(({ run }) => run.roleId)).toEqual(['writer', 'another-writer']);
  expect(agents[0].detail).not.toBe(agents[1].detail);
});
it('supersedes a saved wait only with its answered question continuation', () => {
  const waiting: Run = { ...run, id: 'waiting', status: 'waiting' };
  const continuation: Run = {
    ...run,
    id: 'continuation',
    requestId: 'answer',
    rootRunId: 'upstream',
  };
  const question = {
    runId: waiting.id,
    roleId: waiting.roleId,
    status: 'answered',
    continuationRequestId: 'answer',
  } as UserInputRequest;
  expect(
    jobAgents('job', { ...data, runs: [waiting, continuation], userInputs: [question] }).map(
      ({ run }) => run.id,
    ),
  ).toEqual(['continuation']);
  expect(
    jobAgents('job', {
      ...data,
      runs: [waiting, { ...continuation, status: 'completed' }],
      userInputs: [question],
    }).map(({ run }) => run.id),
  ).toEqual(['waiting']);
  expect(
    jobAgents('job', {
      ...data,
      runs: [waiting, continuation],
      userInputs: [{ ...question, status: 'pending' }],
    }),
  ).toHaveLength(2);
});
it('says an answered wait is handed back, not waiting for the user, until its continuation starts', () => {
  const waiting: Run = { ...run, id: 'waiting', status: 'waiting', requestId: 'asked' };
  const question = {
    runId: waiting.id,
    roleId: waiting.roleId,
    status: 'answered',
    continuationRequestId: 'answer',
  } as UserInputRequest;
  // The continuation is still queued, so the waiting turn stays listed.
  const [agent] = jobAgents('job', { ...data, runs: [waiting], userInputs: [question] });
  expect(agent).toMatchObject({ run: { id: 'waiting' }, handedOff: true });
  expect(agentState(agent!)).toBe('Answer saved');
  expect(turnPreview(waiting, agent!.handedOff).status).toBe('Answer saved');
  const [asking] = jobAgents('job', {
    ...data,
    runs: [waiting],
    userInputs: [{ ...question, status: 'pending' }],
  });
  expect(asking?.handedOff).toBeUndefined();
  expect(agentState(asking!)).toBe('Waiting for you');
  expect(agentState({ run, name: 'Writer' })).toBe('Running');
});
it('follows successive answered questions to the actual waiting turn', () => {
  const first: Run = { ...run, id: 'first', status: 'waiting' };
  const middle: Run = { ...first, id: 'middle', requestId: 'answer-one' };
  const last: Run = { ...first, id: 'last', requestId: 'answer-two' };
  const questions = [
    {
      runId: first.id,
      roleId: first.roleId,
      status: 'answered',
      continuationRequestId: middle.requestId,
    },
    {
      runId: middle.id,
      roleId: middle.roleId,
      status: 'answered',
      continuationRequestId: last.requestId,
    },
  ] as UserInputRequest[];
  expect(
    jobAgents('job', { ...data, runs: [first, middle, last], userInputs: questions }).map(
      ({ run }) => run.id,
    ),
  ).toEqual(['last']);
});
it('previews public commentary and the active step without exposing reasoning text', () => {
  const preview = turnPreview({
    ...run,
    activity: [
      { id: 'private', kind: 'reasoning', label: 'Thinking', status: 'completed', text: 'PRIVATE' },
      {
        id: 'note',
        kind: 'commentary',
        label: 'Update',
        status: 'completed',
        text: 'Checking the brief',
      },
      { id: 'tool', kind: 'tool', label: 'Reading profile', status: 'running' },
    ],
  } as Run);
  expect(preview).toEqual({ status: 'Reading profile', commentary: 'Checking the brief' });
  expect(JSON.stringify(preview)).not.toContain('PRIVATE');
  expect(turnPreview({ ...run, status: 'waiting' }).status).toBe('Waiting for you');
});
it('explains launch prerequisites and identifies obsolete packet reviews', () => {
  expect(launchBlocker(data, undefined)).toContain('Enable');
  expect(
    packetNeedsReview({
      packet: {},
      applicationContext: { revision: 'new' },
      packetReview: { contextRevision: 'old' },
    } as Card),
  ).toBe(true);
  expect(packetNeedsReview({ packet: null } as Card)).toBe(false);
});

it('clears an old failure after newer work succeeds regardless of snapshot order', () => {
  const failed = { ...run, status: 'failed' as const, finishedAt: '2026-10-20T00:01:00Z' };
  const completed = {
    ...run,
    id: 'next',
    status: 'completed' as const,
    finishedAt: '2026-10-20T00:02:00Z',
  };
  expect(latestJobFailure('job', [failed])).toBe(failed);
  expect(latestJobFailure('job', [completed, failed])).toBeUndefined();
  expect(latestJobFailure('job', [failed, completed])).toBeUndefined();
});

it('marks application steps done in order and gives the first open step to whoever moves it', () => {
  const drafted = {
    state: 'in_review',
    packet: { resume: 'r' },
    applicationContext: { revision: 'ctx' },
  } as unknown as Card;
  const rows = applicationRows(drafted, true, false);
  expect(rows.map((row) => [row.id, row.status, row.done])).toEqual([
    ['brief', 'Confirmed', true],
    ['documents', 'Draft available', true],
    ['reviews', 'Review needed', false],
    ['export', 'Not exported', false],
  ]);
  expect(applicationBeads(rows)).toEqual(['done', 'done', 'current', undefined]);
  // Ochre follows the header's rule: only a decision that waits on the user (here the brief).
  const unconfirmed = applicationRows({ state: 'shortlisted' } as Card, false, false);
  expect(applicationBeads(unconfirmed, { waiting: new Set(['brief']) })).toEqual([
    'ochre',
    undefined,
    undefined,
    undefined,
  ]);
  expect(applicationBeads(unconfirmed)).toEqual(['current', undefined, undefined, undefined]);
  const awaiting = {
    ...drafted,
    state: 'awaiting_approval',
    packetReview: { contextRevision: 'ctx' },
  } as unknown as Card;
  const waiting = applicationRows(awaiting, true, false);
  expect(waiting.at(-1)?.status).toBe('Approval requested');
  expect(applicationBeads(waiting, { waiting: new Set(['packet']) })).toEqual([
    'done',
    'done',
    'done',
    'ochre',
  ]);
  // Requested changes reopen the documents; the review is not a reviewed packet.
  const revising = applicationRows({ ...drafted, state: 'changes_requested' }, true, false);
  expect(revising.map((row) => [row.id, row.status, row.done])).toEqual([
    ['brief', 'Confirmed', true],
    ['documents', 'Revision needed', false],
    ['reviews', 'Changes requested', false],
    ['export', 'Not exported', false],
  ]);
  const exported = applicationRows(awaiting, true, true);
  expect(exported.map((row) => row.status)).toEqual([
    'Confirmed',
    'Exported version',
    'Reviewed',
    'Exported',
  ]);
});

it('shows live work on the step it belongs to and nothing current on a closed job', () => {
  const rows = applicationRows({ state: 'in_review', packet: {} } as Card, true, false);
  const review = { id: 'r', purpose: 'application-review' } as Run;
  const steps = liveApplicationSteps(rows, {
    working: { name: 'Reviewer', section: runSection(review) },
  });
  expect(steps.map(({ row, bead }) => [row.id, bead, row.status])).toEqual([
    ['brief', 'done', 'Confirmed'],
    ['documents', 'done', 'Draft available'],
    ['reviews', 'plum', 'Reviewer is working'],
    ['export', undefined, 'Not exported'],
  ]);
  // Fit and packet rating belong to no step, so they never claim one.
  expect(runSection({ id: 'f', purpose: 'packet-evaluation' } as Run)).toBeUndefined();
  expect(runSection({ id: 'd', purpose: 'application-draft', deepReviewId: 'x' } as Run)).toBe(
    'reviews',
  );
  const asked = liveApplicationSteps(rows, {
    asking: { name: 'Scout', section: undefined },
  });
  expect(asked.some(({ bead }) => bead === 'ochre')).toBe(false);
  const closed = applicationRows({ state: 'withdrawn', packet: null } as Card, false, false, false);
  expect(applicationBeads(closed, { closed: true })).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  expect(closed.map((row) => row.status)).toEqual([
    'Not prepared',
    'Not drafted',
    'Not reviewed',
    'Not exported',
  ]);
});

it('leads Scout notes with a reason, not the score caveat, and keeps score talk that explains fit', () => {
  const caveat = '85/100 reflects supported experience, not the probability of an offer.';
  expect(leadNotes([caveat, 'Strong React evidence.', 'EU eligibility unclear.'])).toEqual([
    'Strong React evidence.',
    caveat,
    'EU eligibility unclear.',
  ]);
  // A score mentioned in a substantive reason is not a caveat.
  const reason = 'Scored 85/100 because the editor work matches closely.';
  expect(leadNotes([reason, 'Other note.'])).toEqual([reason, 'Other note.']);
  expect(leadNotes([caveat])).toEqual([caveat]);
});
