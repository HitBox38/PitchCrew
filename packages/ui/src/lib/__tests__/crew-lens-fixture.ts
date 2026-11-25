import type { RuntimeInfo, Routine, Snapshot, WorkQueueView } from '@pitchcrew/core';
import {
  ago,
  browserApproval,
  card,
  delivery,
  instructionUpdate,
  question,
  queue,
  request,
  roleProposal,
  run,
  snapshot,
  task,
} from './attention-fixture.ts';

// Fictional snapshots for Crew's At work lens, shared by the lens model and component tests.

/**
 * A runtime this workspace has, installed unless `available` says otherwise, that isolates
 * application work as Demo does (spread `applicationIsolation: false` over it for one that cannot).
 */
export const runtime = (id: RuntimeInfo['id'], available = true) =>
  ({
    id,
    available,
    version: '',
    detail: '',
    models: [],
    applicationIsolation: true,
  }) as unknown as RuntimeInfo;

/**
 * The fixture's agents all run on Demo, installed here, so their queued work can start; the
 * shared `snapshot()` lists no runtimes, which the lens reads as nothing installed.
 */
export const installed = (data: Snapshot): Snapshot =>
  data.runtimes.length ? data : { ...data, runtimes: [runtime('demo')] };

/** A ready queue whose next request waits for a slot, for `roleId`'s board action. */
export const waiting = (cardId: string, roleId = 'scout', fields: Partial<WorkQueueView> = {}) =>
  queue(`job:${cardId}`, {
    requests: [
      request(`fit-${cardId}`, {
        boardAction: 'fit',
        content: 'Evaluate fit',
        deliveries: [delivery(roleId, 'queued')],
      }),
    ],
    ...fields,
  });

export const routine = (fields: Partial<Routine>) =>
  ({
    id: 'routine-1',
    name: 'Morning scan',
    roleId: 'scout',
    content: 'Scan the saved sources.',
    cardId: null,
    startAt: ago(9000),
    timezone: 'UTC',
    cron: null,
    intervalMinutes: 1440,
    maxRuns: null,
    endsAt: null,
    enabled: true,
    createdBy: 'user',
    updatedBy: 'user',
    createdAt: ago(9000),
    updatedAt: ago(9000),
    deletedAt: null,
    runCount: 3,
    nextRunAt: ago(-120),
    lastRunId: null,
    lastScheduledAt: null,
    error: '',
    ...fields,
  }) as Routine;

/**
 * The shared cast in miniature, four of four slots busy: Writer drafts Acme Robotics and runs
 * Reviewer's follow-up on Globex while its question on Umbra Health waits; Submitter's run waits
 * for a browser OK on Initech; Scout evaluates Lumen Labs, three fits wait for a slot and Corvid's
 * failed. A Writer proposal and a new default for Scout wait too, and must stay off the lens.
 */
export const cast = (fields: Partial<Snapshot> = {}) => {
  const runs = [
    run('run-acme', {
      cardId: 'acme',
      threadId: 't-acme',
      purpose: 'application-draft',
      startedAt: ago(12),
    }),
    run('run-review', {
      cardId: 'globex',
      roleId: 'reviewer',
      status: 'completed',
      startedAt: ago(40),
      finishedAt: ago(6),
    }),
    run('run-globex', {
      cardId: 'globex',
      threadId: 't-globex',
      taskId: 'task-globex',
      startedAt: ago(5),
    }),
    run('run-submit', {
      cardId: 'initech',
      roleId: 'submitter',
      threadId: 't-initech',
      startedAt: ago(18),
    }),
    run('run-lumen', { cardId: 'lumen', roleId: 'scout', purpose: 'fit', startedAt: ago(9) }),
    run('run-ask', { cardId: 'umbra', status: 'waiting', purpose: 'application-draft' }),
  ];
  const queues = [
    queue('job:acme', { state: 'running', runs: [runs[0]!] }),
    queue('job:initech', { state: 'running', runs: [runs[3]!] }),
    queue('job:lumen', { state: 'running', runs: [runs[4]!] }),
    queue('job:globex', {
      state: 'running',
      runs: [runs[2]!],
      tasks: [
        task('task-globex', {
          parentRunId: 'run-review',
          cardId: 'globex',
          status: 'running',
          runId: 'run-globex',
        }),
      ],
    }),
    queue('job:umbra', {
      state: 'waiting',
      requests: [
        request('draft-umbra', {
          boardAction: 'draft',
          content: 'Draft application',
          deliveries: [delivery('writer', 'waiting', 'run-ask')],
        }),
      ],
    }),
    queue('job:corvid', {
      state: 'paused',
      paused: true,
      pauseKind: 'failed',
      reason: 'Scout’s fit evaluation stopped before finishing. Retry or skip this request.',
      requests: [
        request('fit-corvid', {
          boardAction: 'fit',
          content: 'Evaluate fit',
          createdAt: ago(55),
          deliveries: [delivery('scout', 'failed')],
        }),
      ],
    }),
    waiting('northwind'),
    waiting('kestrel'),
    waiting('tidepool'),
  ];
  return snapshot({
    runtimes: [runtime('demo')],
    cards: [
      card('acme', { company: 'Acme Robotics', state: 'drafting' }),
      card('globex', { company: 'Globex', state: 'changes_requested' }),
      card('initech', { company: 'Initech', state: 'awaiting_approval' }),
      card('umbra', { company: 'Umbra Health', state: 'drafting' }),
      card('lumen', { company: 'Lumen Labs' }),
      card('corvid', { company: 'Corvid' }),
      card('northwind', { company: 'Northwind' }),
      card('kestrel', { company: 'Kestrel AI' }),
      card('tidepool', { company: 'Tidepool' }),
    ],
    runs,
    tasks: queues[3]!.tasks,
    queue: { concurrency: 4, active: 4, background: 0, queues },
    computerApprovals: [browserApproval('approval-1')],
    userInputs: [question('question-1')],
    proposals: [roleProposal('proposal-1')],
    instructionUpdates: [instructionUpdate('scout')],
    ...fields,
  });
};
