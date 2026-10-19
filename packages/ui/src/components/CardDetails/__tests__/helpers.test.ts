import { expect, it } from 'vitest';
import type { Card, Run, Snapshot } from '@pitchcrew/core';
import {
  jobAgents,
  turnPreview,
  launchBlocker,
  packetNeedsReview,
  latestJobFailure,
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
it('shows actual review workers instead of the coordinating parent and superseded waits', () => {
  const parent = { ...run, roleId: 'reviewer', id: 'parent' };
  const child = { ...run, id: 'child', rootRunId: 'parent' };
  const reviewer = { ...run, roleId: 'reviewer', id: 'second-opinion' };
  const waiting = { ...run, id: 'waiting', status: 'waiting' as const };
  expect(
    jobAgents('job', { ...data, runs: [parent, child, reviewer, waiting] }).map(
      ({ run }) => run.id,
    ),
  ).toEqual(['child', 'second-opinion']);
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
