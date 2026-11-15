import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Board } from '@pitchcrew/board';
import type { AgentTask, ChatRequest, Run } from '@pitchcrew/core';
import type { CrewContext } from '../src/crew/types.ts';
import { createConversation, migrateConversations } from '../src/crew/conversations.ts';
import {
  drainConversationQueue,
  sendConversation,
  updateRequest,
} from '../src/crew/conversation-queue.ts';
import { drainTasks } from '../src/crew/tasks.ts';
import { startTaskRun } from '../src/crew/task-start.ts';
import { addMessage } from '../src/crew/chat.ts';
import { queueMayStart } from '../src/crew/queue/dispatch.ts';

vi.mock('../src/crew/queue/dispatch.ts', async (original) => {
  const actual = await original<typeof import('../src/crew/queue/dispatch.ts')>();
  return { ...actual, queueMayStart: vi.fn(actual.queueMayStart) };
});

const resources: { directory: string; board: Board; context: CrewContext }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const item of resources.splice(0)) {
    item.context.closing = true;
    item.board.close();
    await rm(item.directory, { recursive: true, force: true });
  }
});
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-drain-races-'));
  const board = new Board(join(directory, 'board.sqlite'));
  const context = {
    directory,
    board,
    closing: true,
    initializing: false,
    profileWriting: false,
    draining: false,
    drainAgain: false,
    configuring: new Set(),
    taskPermissionsAllow: () => true,
    runtimes: [{ id: 'codex', available: true }],
    runtimeMaintenance: { refreshOnRetry: vi.fn(async () => {}), held: () => false },
    skills: () => [],
    publishChat: () => {},
    queueReservations: new Map(),
    queueChains: new Map(),
    controllers: new Map(),
    streamingMessages: new Map(),
    startChatRun: vi.fn(),
    startRun: vi.fn(),
  } as unknown as CrewContext;
  resources.push({ directory, board, context });
  context.addMessage = (...args) => addMessage(context, ...args);
  context.drainTasks = () => drainTasks(context);
  context.board.seedRoles('codex', true);
  migrateConversations(context);
  return context;
};
const gateOf = () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release };
};
const time = '2026-11-11T00:00:00.000Z';
const seedFollowUp = (context: CrewContext) => {
  createConversation(context, { title: 'Origin', participants: ['scout'] });
  const parent: Run = {
    id: 'parent',
    cardId: null,
    roleId: 'scout',
    runtime: 'codex',
    status: 'completed',
    message: 'Synthetic completed turn',
    startedAt: time,
    finishedAt: time,
    mode: 'chat',
    threadId: 'scout',
  };
  context.board.record('run', parent, 'user', 'Synthetic parent run');
  const task: AgentTask = {
    id: 'follow-up',
    parentRunId: 'parent',
    rootRunId: 'parent',
    roleId: 'writer',
    cardId: null,
    mode: 'chat',
    trigger: 'message',
    threadId: 'writer',
    content: 'Synthetic follow-up',
    status: 'queued',
    runId: null,
    error: '',
    createdAt: time,
  };
  context.board.record('task', task, 'scout', 'Synthetic queued follow-up');
  return task;
};
const storedTask = (context: CrewContext) => context.board.get<AgentTask>('task', 'follow-up');
const cancelTask = (context: CrewContext) =>
  context.board.record(
    'task',
    { ...storedTask(context), status: 'cancelled', error: 'Stopped by the user.' },
    'user',
    'Synthetic Stop',
  );

it('skips a queued delivery whose recipient an edit removed while an earlier request was starting', async () => {
  const context = await fixture();
  const group = createConversation(context, { title: 'Pair', participants: ['scout', 'writer'] });
  await sendConversation(context, group.id, { content: '@scout First' });
  const second = await sendConversation(context, group.id, { content: '@writer Second' });
  const { gate, release } = gateOf();
  vi.mocked(context.startChatRun).mockImplementationOnce(async () => {
    await gate;
    return { id: 'run-first' } as Run;
  });
  context.closing = false;
  const drain = drainConversationQueue(context);
  await vi.waitFor(() => expect(context.startChatRun).toHaveBeenCalledTimes(1));
  updateRequest(context, second.id, { action: 'edit', content: '@scout Second' });
  release();
  await expect(drain).resolves.toBeUndefined();
  context.closing = true;
  expect(context.board.get<ChatRequest>('chat_request', second.id).deliveries).toEqual([
    { roleId: 'scout', status: 'queued', runId: null, error: '' },
  ]);
});

it('does not launch a chat request removed while admission was awaited', async () => {
  const context = await fixture();
  const request = await sendConversation(context, 'scout', { content: 'Do the thing' });
  const { gate, release } = gateOf();
  vi.mocked(queueMayStart).mockImplementationOnce(async () => {
    await gate;
    return true;
  });
  context.closing = false;
  const drain = drainConversationQueue(context);
  await vi.waitFor(() => expect(queueMayStart).toHaveBeenCalled());
  updateRequest(context, request.id, { action: 'remove' });
  release();
  await drain;
  context.closing = true;
  expect(context.startChatRun).not.toHaveBeenCalled();
  expect(context.board.get<ChatRequest>('chat_request', request.id).deliveries[0]?.status).toBe(
    'cancelled',
  );
});

it('leaves a crew follow-up cancelled when Stop lands while admission is awaited', async () => {
  const context = await fixture();
  seedFollowUp(context);
  const { gate, release } = gateOf();
  vi.mocked(queueMayStart).mockImplementationOnce(async () => {
    await gate;
    return true;
  });
  context.closing = false;
  const drain = drainTasks(context);
  await vi.waitFor(() => expect(queueMayStart).toHaveBeenCalled());
  cancelTask(context);
  release();
  await drain;
  context.closing = true;
  expect(context.startChatRun).not.toHaveBeenCalled();
  expect(storedTask(context).status).toBe('cancelled');
});

it('ends a run that started for a crew follow-up cancelled during launch', async () => {
  const context = await fixture();
  seedFollowUp(context);
  const { gate, release } = gateOf();
  const controller = new AbortController();
  vi.mocked(context.startChatRun).mockImplementationOnce(async () => {
    await gate;
    // Mirror the real launch: the run is saved with its task and the task is marked running only
    // if it is still queued, so a follow-up cancelled during the await stays cancelled.
    const saved: Run = {
      id: 'run-follow-up',
      cardId: null,
      roleId: 'writer',
      runtime: 'codex',
      status: 'running',
      message: 'Synthetic follow-up run',
      startedAt: time,
      finishedAt: null,
      mode: 'chat',
      threadId: 'writer',
      taskId: 'follow-up',
    };
    context.board.record('run', saved, 'orchestrator', 'Synthetic follow-up run');
    startTaskRun(context, saved);
    context.controllers.set('run-follow-up', controller);
    return saved;
  });
  context.closing = false;
  const drain = drainTasks(context);
  await vi.waitFor(() => expect(context.startChatRun).toHaveBeenCalledTimes(1));
  cancelTask(context);
  release();
  await drain;
  context.closing = true;
  expect(storedTask(context).status).toBe('cancelled');
  expect(controller.signal.aborted).toBe(true);
});

it('logs and resolves when a drain hits an unexpected error', async () => {
  const context = await fixture();
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  await sendConversation(context, 'scout', { content: 'Do the thing' });
  context.runtimeMaintenance.held = () => {
    throw new Error('Synthetic failure');
  };
  context.closing = false;
  await expect(drainConversationQueue(context)).resolves.toBeUndefined();
  expect(logged).toHaveBeenCalledTimes(1);
  seedFollowUp(context);
  context.runtimeMaintenance.held = () => false;
  context.taskPermissionsAllow = () => {
    throw new Error('Synthetic failure');
  };
  await expect(drainTasks(context)).resolves.toBeUndefined();
  context.closing = true;
  // The follow-up drain chains a chat drain, whose admission check hits the same failing hook.
  expect(logged.mock.calls.map(([line]) => String(line).split(':')[0])).toContain(
    'Queue drain failed (crew follow-ups)',
  );
});
