import { afterEach, expect, it, vi } from 'vitest';
import { Board } from '@pitchcrew/board';
import type {
  AgentTask,
  Conversation,
  DelegationRound,
  Role,
  Run,
  UserInputRequest,
  WorkQueue,
} from '@pitchcrew/core';
import type { CrewContext } from '../src/crew/types.ts';
import { activeRuns } from '../src/crew/queue/queries.ts';
import { activeQueues, queueWaiting, taskLane } from '../src/crew/queue/state.ts';
import { workspaceQueue } from '../src/crew/queue/projection.ts';
import { launchProblem } from '../src/crew/queue/admission.ts';
import { queueMayStart } from '../src/crew/queue/dispatch.ts';

const boards: Board[] = [];
const time = '2026-11-07T00:00:00.000Z';
const fixture = () => {
  const board = new Board(':memory:');
  boards.push(board);
  const context = {
    board,
    controllers: new Map(),
    queueReservations: new Map(),
    queueChains: new Map(),
    configuring: new Set(),
    taskPermissionsAllow: () => true,
    runtimeMaintenance: { held: () => false },
    runtimes: [{ id: 'codex', available: true, version: 'fictional', detail: '' }],
  } as unknown as CrewContext;
  return context;
};
const save = (
  context: CrewContext,
  kind: Parameters<Board['record']>[0],
  value: Parameters<Board['record']>[1],
) => context.board.record(kind, value, 'user', 'Synthetic queue fixture');
const thread = (context: CrewContext, id: string, patch: Partial<Conversation> = {}) => {
  const value: Conversation = {
    id,
    title: id,
    kind: 'direct',
    participants: ['writer'],
    leadId: null,
    cardId: null,
    createdBy: 'user',
    createdAt: time,
    updatedAt: time,
    archived: false,
    pinned: false,
    configurations: {},
    ...patch,
  };
  save(context, 'conversation', value);
  return value;
};
const queue = (context: CrewContext, item: Conversation, patch: Partial<WorkQueue> = {}) => {
  const value: WorkQueue = {
    id: item.cardId ? `job:${item.cardId}` : `conversation:${item.id}`,
    cardId: item.cardId,
    threadId: item.id,
    order: 1,
    paused: false,
    reason: '',
    updatedAt: time,
    ...patch,
  };
  save(context, 'work_queue', value);
  return value;
};
const run = (context: CrewContext, id: string, patch: Partial<Run> = {}) => {
  const value: Run = {
    id,
    cardId: null,
    roleId: 'writer',
    runtime: 'codex',
    status: 'completed',
    message: 'Synthetic completed turn',
    startedAt: time,
    finishedAt: time,
    mode: 'chat',
    threadId: 'origin',
    ...patch,
  };
  save(context, 'run', value);
  return value;
};
const task = (context: CrewContext, id: string, patch: Partial<AgentTask> = {}) => {
  const value: AgentTask = {
    id,
    parentRunId: 'parent',
    rootRunId: 'parent',
    roleId: 'writer',
    cardId: null,
    mode: 'chat',
    trigger: 'message',
    threadId: 'origin',
    content: 'Synthetic follow-up',
    status: 'queued',
    runId: null,
    error: '',
    createdAt: time,
    ...patch,
  };
  save(context, 'task', value);
  return value;
};
const writer: Role = {
  id: 'writer',
  name: 'Writer',
  description: 'Synthetic queue role',
  runtime: 'codex',
  model: '',
  enabled: true,
  instructions: '',
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const board of boards.splice(0)) board.close();
});

it('retains terminal controller-owned cleanup, launch reservations and insertion order', () => {
  const context = fixture();
  const origin = thread(context, 'origin');
  queue(context, origin);
  const cleanup = run(context, 'cleanup', { rootRunId: 'parent' });
  const parent = run(context, 'parent', { roleId: 'scout', status: 'running', finishedAt: null });
  context.controllers.set(cleanup.id, new AbortController());
  context.controllers.set('no-longer-stored', new AbortController());
  context.queueReservations.set('reservation', {
    lane: 'conversation:reserved',
    root: 'reservation-root',
    thread: 'reserved',
    role: 'writer',
  });
  expect(activeRuns(context).map((entry) => entry.id)).toEqual([cleanup.id, parent.id]);
  expect([...activeQueues(context)]).toEqual([
    ['conversation:origin', new Set(['parent'])],
    ['conversation:reserved', new Set(['reservation-root'])],
  ]);
  expect(
    launchProblem(context, {
      cardId: null,
      threadId: origin.id,
      roleId: 'writer',
      rootRunId: parent.id,
    }),
  ).toBe('This conversation participant already has an active turn.');
  const projection = workspaceQueue(context);
  expect(projection.active).toBe(2);
  expect(projection.queues[0].runs.map((entry) => entry.id)).toEqual([cleanup.id, parent.id]);
  context.controllers.delete(cleanup.id);
  expect(activeRuns(context).map((entry) => entry.id)).toEqual([parent.id]);
});

it('looks up completed parents for admitted chains and oldest ready follow-ups in a DM', async () => {
  const context = fixture();
  save(context, 'role', writer);
  const origin = thread(context, 'origin');
  const dm = thread(context, 'dm', { kind: 'agent_dm', participants: ['scout', 'writer'] });
  const first = queue(context, origin);
  const later = queue(context, thread(context, 'later'), { order: 2 });
  const parent = run(context, 'parent', { roleId: 'scout' });
  const followup = task(context, 'follow-up', { threadId: dm.id });
  expect(taskLane(context, followup)).toBe(first.id);
  context.queueChains.set(first.id, parent.id);
  expect(activeQueues(context).get(first.id)).toEqual(new Set([parent.id]));
  expect(await queueMayStart(context, first.id, parent.id)).toBe(true);
  context.queueChains.clear();
  expect(await queueMayStart(context, later.id, 'later-root')).toBe(false);
  expect(await queueMayStart(context, first.id, parent.id)).toBe(true);
  expect(workspaceQueue(context).queues[0].tasks.map((entry) => entry.id)).toEqual([followup.id]);
});

it('keeps failed tasks visible only in their paused lane and preserves routine and round roots', () => {
  const context = fixture();
  const origin = thread(context, 'origin');
  const paused = queue(context, origin, {
    paused: true,
    pauseKind: 'failed',
    reason: 'Synthetic failure',
  });
  const other = thread(context, 'other');
  queue(context, other, { order: 2 });
  run(context, 'parent');
  run(context, 'other-parent', { threadId: other.id });
  const failed = task(context, 'failed', { status: 'failed', error: 'Synthetic failure' });
  task(context, 'hidden-failure', {
    rootRunId: 'other-parent',
    parentRunId: 'other-parent',
    threadId: other.id,
    status: 'failed',
  });
  run(context, 'routine-parent', { threadId: other.id, routineId: 'routine' });
  const routine = task(context, 'routine-followup', {
    rootRunId: 'routine-parent',
    parentRunId: 'routine-parent',
    threadId: other.id,
  });
  context.queueChains.set('routine:routine', 'routine-parent');
  expect(taskLane(context, routine)).toBe('routine:routine');
  expect(workspaceQueue(context)).toMatchObject({
    active: 1,
    background: 1,
    queues: [{ id: paused.id, state: 'paused', tasks: [{ id: failed.id }] }],
  });
  const round: DelegationRound = {
    id: 'round',
    threadId: other.id,
    cardId: null,
    leadId: 'scout',
    initiator: 'user',
    rootRunId: 'round-request',
    parentRunId: null,
    requestId: 'round-request',
    delegates: [{ roleId: 'writer', taskId: 'round-delegate', threadId: 'dm' }],
    collectionTaskId: 'round-collection',
    status: 'queued',
    createdAt: time,
    settledAt: null,
  };
  save(context, 'delegation_round', round);
  save(context, 'chat_request', {
    id: 'round-request',
    threadId: other.id,
    messageId: 'round-message',
    content: 'Synthetic round',
    attachments: [],
    createdAt: time,
    order: 1,
    deliveries: [],
  });
  task(context, 'round-delegate', {
    rootRunId: round.rootRunId,
    parentRunId: round.rootRunId,
    roundId: round.id,
    roundPart: 'delegate',
    threadId: 'dm',
    status: 'completed',
  });
  const collection = task(context, 'round-collection', {
    rootRunId: round.rootRunId,
    parentRunId: round.rootRunId,
    roundId: round.id,
    roundPart: 'collection',
    threadId: other.id,
  });
  context.queueChains.set(`conversation:${other.id}`, round.rootRunId);
  expect(taskLane(context, collection)).toBe(`conversation:${other.id}`);
  expect(activeQueues(context).get(`conversation:${other.id}`)).toEqual(new Set([round.rootRunId]));
  const delegate = context.board.get<AgentTask>('task', 'round-delegate');
  save(context, 'task', { ...delegate, status: 'waiting' });
  expect(activeQueues(context).has(`conversation:${other.id}`)).toBe(false);
  save(context, 'task', delegate);
  save(context, 'delegation_round', { ...round, status: 'cancelled' });
  expect(activeQueues(context).has(`conversation:${other.id}`)).toBe(false);
});

it('preserves job-wide pending-question holds across attached conversations', async () => {
  const context = fixture();
  save(context, 'role', writer);
  const first = thread(context, 'job-first', { cardId: 'job' });
  const second = thread(context, 'job-second', { cardId: 'job' });
  const jobQueue = queue(context, first);
  run(context, 'parent', { cardId: 'job', threadId: first.id });
  const followup = task(context, 'job-followup', { cardId: 'job', threadId: second.id });
  context.queueChains.set(jobQueue.id, 'parent');
  const question: UserInputRequest = {
    id: 'question',
    threadId: first.id,
    sourceThreadId: first.id,
    roleId: 'writer',
    runId: 'parent',
    messageId: 'question-message',
    cardId: 'job',
    question: 'Synthetic question',
    reason: '',
    continuationNotes: '',
    options: [],
    multiSelect: false,
    createdAt: time,
    status: 'pending',
  };
  save(context, 'user_input', question);
  expect(taskLane(context, followup)).toBe(jobQueue.id);
  expect(queueWaiting(context, jobQueue.id)).toBe(true);
  expect(activeQueues(context).has(jobQueue.id)).toBe(false);
  expect(
    launchProblem(context, {
      cardId: 'job',
      threadId: second.id,
      roleId: 'writer',
      rootRunId: 'parent',
    }),
  ).toBe('Waiting for your answer.');
  expect(await queueMayStart(context, 'conversation:unrelated', 'unrelated')).toBe(true);
});

it('uses the status index and never parses unrelated settled run/task payloads in normal queue paths', async () => {
  const context = fixture();
  save(context, 'role', writer);
  const origin = thread(context, 'origin');
  const activeQueue = queue(context, origin);
  const parent = run(context, 'parent');
  const followup = task(context, 'follow-up');
  context.queueChains.set(activeQueue.id, parent.id);
  const insert = context.board.db.prepare('INSERT INTO entities(kind,id,json) VALUES (?,?,?)');
  const sentinel = 'UNRELATED_SETTLED_HISTORY_MUST_NOT_BE_PARSED';
  context.board.db.transaction(() => {
    for (let index = 0; index < 10_000; index++) {
      const root = `old-root-${Math.floor(index / 5)}`;
      if (index % 5 === 0)
        insert.run('run', root, JSON.stringify({ ...parent, id: root, message: sentinel }));
      insert.run(
        'run',
        `old-run-${index}`,
        JSON.stringify({
          ...parent,
          id: `old-run-${index}`,
          rootRunId: root,
          taskId: `old-task-${index}`,
          message: sentinel,
        }),
      );
      insert.run(
        'task',
        `old-task-${index}`,
        JSON.stringify({
          ...followup,
          id: `old-task-${index}`,
          rootRunId: root,
          parentRunId: root,
          status: 'completed',
          runId: `old-run-${index}`,
          content: sentinel,
        }),
      );
    }
  })();
  const original = JSON.parse;
  vi.spyOn(JSON, 'parse').mockImplementation((text, reviver) => {
    if (text.includes(sentinel)) throw new Error('Unrelated settled history was deserialized.');
    return original(text, reviver);
  });
  const list = vi.spyOn(context.board, 'list');
  expect(activeQueues(context).get(activeQueue.id)).toEqual(new Set([parent.id]));
  expect(workspaceQueue(context).queues[0].tasks).toHaveLength(1);
  expect(
    launchProblem(context, {
      cardId: null,
      threadId: origin.id,
      roleId: 'writer',
      rootRunId: parent.id,
    }),
  ).toBe('');
  context.queueChains.clear();
  expect(await queueMayStart(context, activeQueue.id, parent.id)).toBe(true);
  expect(list.mock.calls.every(([kind]) => kind !== 'run' && kind !== 'task')).toBe(true);
  const plan = context.board.db
    .prepare(
      "EXPLAIN QUERY PLAN SELECT rowid AS position,json FROM entities WHERE kind='task' AND json_extract(json,'$.status') IN (SELECT value FROM json_each(?))",
    )
    .all('["queued"]') as { detail: string }[];
  expect(plan.some((entry) => entry.detail.includes('entities_queue_status'))).toBe(true);
});
