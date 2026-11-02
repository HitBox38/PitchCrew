import type { AgentTask, DelegationRound } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { roundBead, roundMembers, roundStatusLabels } from '../rounds.ts';

const round = {
  id: 'r1',
  threadId: 'group',
  cardId: null,
  leadId: 'scout',
  initiator: 'user',
  rootRunId: 'req',
  parentRunId: null,
  requestId: 'req',
  delegates: [
    { roleId: 'writer', taskId: 't1', threadId: 'dm-writer' },
    { roleId: 'reviewer', taskId: 't2', threadId: 'dm-reviewer' },
  ],
  collectionTaskId: 't3',
  status: 'running',
  createdAt: '2026-11-02T10:00:00.000Z',
  settledAt: null,
} satisfies DelegationRound;
const task = (id: string, status: AgentTask['status'], extra: Partial<AgentTask> = {}) =>
  ({ id, status, threadId: 'dm', runId: null, content: 'Do it', error: '', ...extra }) as AgentTask;

it('lists every delegate before the collection with each task state', () => {
  const members = roundMembers(round, [
    task('t1', 'running', { runId: 'run-1', threadId: 'dm-writer' }),
    task('t2', 'failed', { error: 'Runtime stopped.' }),
  ]);
  expect(members.map((member) => [member.roleId, member.part, member.status])).toEqual([
    ['writer', 'delegate', 'running'],
    ['reviewer', 'delegate', 'failed'],
    ['scout', 'collection', 'queued'],
  ]);
  expect(members[0]?.runId).toBe('run-1');
  expect(members[1]?.error).toBe('Runtime stopped.');
  expect(members[2]?.threadId).toBe('group');
});
it('maps round status to one bead and a readable label', () => {
  expect(roundBead(round)).toBe('running');
  expect(roundBead({ ...round, status: 'collecting' })).toBe('running');
  expect(roundBead({ ...round, status: 'completed' })).toBe('completed');
  expect(roundBead({ ...round, status: 'cancelled' })).toBe('cancelled');
  expect(roundBead({ ...round, status: 'queued' })).toBe('queued');
  expect(roundStatusLabels.collecting).toBe('Collecting results');
});
