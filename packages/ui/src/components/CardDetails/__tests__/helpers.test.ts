import { expect, it } from 'vitest';
import type { Card, Run, Snapshot, UserInputRequest } from '@pitchcrew/core';
import {
  jobAgents,
  turnPreview,
  launchBlocker,
  packetNeedsReview,
  latestJobFailure,
  applicationRows,
  applicationBeads,
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
  const unconfirmed = applicationRows({ state: 'shortlisted' } as Card, false, false);
  expect(applicationBeads(unconfirmed)).toEqual(['ochre', undefined, undefined, undefined]);
  const awaiting = {
    ...drafted,
    state: 'awaiting_approval',
    packetReview: { contextRevision: 'ctx' },
  } as unknown as Card;
  const waiting = applicationRows(awaiting, true, false);
  expect(waiting.at(-1)?.status).toBe('Approval requested');
  expect(applicationBeads(waiting)).toEqual(['done', 'done', 'done', 'ochre']);
});
