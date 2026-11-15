import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Board } from '@pitchcrew/board';
import type {
  ChatMessage,
  ChatRequest,
  Conversation,
  Role,
  Run,
  UserInputRequest,
  WorkQueue,
} from '@pitchcrew/core';
import type { CrewContext } from '../src/crew/types.ts';
import { migrateConversations } from '../src/crew/conversations.ts';
import { sendConversation, sendDelegation } from '../src/crew/conversation-queue.ts';
import { addMessage } from '../src/crew/chat.ts';
import { chatSubmissionReceipt } from '../src/crew/chat-submissions.ts';
import { readAttachment } from '../src/crew/attachments/storage.ts';

const resources: { directory: string; board: Board }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const item of resources.splice(0)) {
    item.board.close();
    await rm(item.directory, { recursive: true, force: true });
  }
});
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-send-receipts-'));
  const resource = { directory, board: new Board(join(directory, 'board.sqlite')) };
  resources.push(resource);
  const context = {
    directory,
    board: resource.board,
    closing: true,
    runtimes: [{ id: 'codex', available: true }],
    runtimeMaintenance: { refreshOnRetry: vi.fn(async () => {}) },
    skills: () => [],
    publishChat: () => {},
    queueReservations: new Map(),
    queueChains: new Map(),
    controllers: new Map(),
    streamingMessages: new Map(),
  } as unknown as CrewContext;
  context.addMessage = (...args) => addMessage(context, ...args);
  context.board.seedRoles('codex', true);
  migrateConversations(context);
  return { context, resource };
};

it('coalesces simultaneous uploads, persists one message/receipt, and replays it after reopening and rebuild', async () => {
  const { context, resource } = await fixture();
  const input = {
    clientRequestId: randomUUID(),
    content: 'Read this note',
    attachments: [{ name: 'note.txt', data: 'eA==' }],
  };
  const [first, second] = await Promise.all([
    sendConversation(context, 'scout', input),
    sendConversation(context, 'scout', input),
  ]);
  expect(first.id).toBe(second.id);
  expect(context.board.list<ChatRequest>('chat_request')).toHaveLength(1);
  expect(context.board.events().find((event) => event.kind === 'chat_request')?.version).toBe(36);
  expect(context.board.list<ChatMessage>('message')).toHaveLength(1);
  expect(await readdir(join(resource.directory, 'chat-attachments'))).toHaveLength(1);
  context.board.close();
  resource.board = new Board(join(resource.directory, 'board.sqlite'));
  context.board = resource.board;
  context.board.rebuild();
  context.board.record(
    'role',
    { ...context.board.get<Role>('role', 'scout'), enabled: false },
    'user',
    'Paused Scout',
  );
  // A receipt remains readable even after a role becomes unavailable; replay starts no work.
  expect(
    (
      await sendConversation(context, 'scout', {
        ...input,
        references: [],
        content: ' Read this note ',
      })
    ).id,
  ).toBe(first.id);
  expect(chatSubmissionReceipt(context, 'scout', input.clientRequestId)?.id).toBe(first.id);
  expect(chatSubmissionReceipt(context, 'writer', input.clientRequestId)).toBeNull();
  expect(context.board.list<ChatMessage>('message')).toHaveLength(1);
});

it('uses indexed order endpoints for ordinary and negative interrupt ordering, ignoring empty legacy values', async () => {
  const { context } = await fixture();
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  const prepare = vi.spyOn(context.board.db, 'prepare');
  const insert = context.board.db.prepare('INSERT INTO entities(kind,id,json) VALUES (?,?,?)');
  const history = (order: unknown) => {
    const id = randomUUID();
    insert.run(
      'chat_request',
      id,
      JSON.stringify({
        id,
        threadId: 'scout',
        messageId: randomUUID(),
        content: 'Historical fixture',
        attachments: [],
        createdAt: new Date().toISOString(),
        order,
        deliveries: [],
      }),
    );
  };
  history(null);
  history(undefined);
  history('legacy-invalid-order');
  const first = await sendConversation(context, 'scout', { content: 'First queued send' });
  expect(first.order).toBe(1000);
  history(-50);
  history(10_000.5);
  expect(
    (await sendConversation(context, 'scout', { content: 'After the latest order' })).order,
  ).toBe(10_001.5);
  expect(
    (await sendConversation(context, 'scout', { content: 'Interrupt first', intent: 'interrupt' }))
      .order,
  ).toBe(-51);
  expect(
    (await sendConversation(context, 'scout', { content: 'Interrupt again', intent: 'interrupt' }))
      .order,
  ).toBe(-52);
  for (const direction of ['ASC', 'DESC']) {
    const query = prepare.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes(`ORDER BY json_extract(json,'$.order') ${direction} LIMIT 1`));
    expect(query).toBeDefined();
    const plan = context.board.db.prepare(`EXPLAIN QUERY PLAN ${query}`).all() as {
      detail: string;
    }[];
    expect(plan.some((row) => row.detail.includes('entities_chat_request_order'))).toBe(true);
    expect(plan.some((row) => row.detail.includes('TEMP B-TREE'))).toBe(false);
  }
});

it.each(['Interrupt safely', '/hiring-panel'])(
  'commits interrupt acceptance before effects and rolls back failures: %s',
  async (content) => {
    const { context } = await fixture();
    const controller = new AbortController();
    const run: Run = {
      id: randomUUID(),
      cardId: null,
      roleId: 'scout',
      runtime: 'codex',
      status: 'running',
      message: 'Working',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      threadId: 'scout',
      mode: 'chat',
    };
    context.board.record('run', run, 'scout', 'Started');
    context.controllers.set(run.id, controller);
    const earlier: ChatRequest = {
      id: randomUUID(),
      threadId: 'scout',
      messageId: randomUUID(),
      content: 'Earlier queued message',
      attachments: [],
      createdAt: run.startedAt,
      order: 1,
      deliveries: [{ roleId: 'scout', status: 'queued', runId: null, error: '' }],
    };
    context.board.record('chat_request', earlier, 'user', 'Queued fixture');
    const question = {
      id: randomUUID(),
      runId: run.id,
      roleId: 'scout',
      threadId: 'scout',
      sourceThreadId: 'scout',
      status: 'pending',
    } as UserInputRequest;
    context.board.record('user_input', question, 'scout', 'Asked');
    context.queueChains.set('conversation:scout', run.id);
    const input = {
      clientRequestId: randomUUID(),
      intent: 'interrupt',
      content,
      attachments: [{ name: 'note.txt', data: 'eA==' }],
    };
    const message = context.addMessage;
    const publishedInsideTransaction: boolean[] = [];
    context.publishChat = () => {
      publishedInsideTransaction.push(context.board.db.inTransaction);
    };
    context.addMessage = () => {
      throw new Error('Forced message-write failure');
    };
    await expect(sendConversation(context, 'scout', input)).rejects.toThrow(
      'Forced message-write failure',
    );
    expect(controller.signal.aborted).toBe(false);
    expect(publishedInsideTransaction).toEqual([]);
    expect(context.queueChains.get('conversation:scout')).toBe(run.id);
    expect(context.board.get<UserInputRequest>('user_input', question.id).status).toBe('pending');
    expect(chatSubmissionReceipt(context, 'scout', input.clientRequestId)).toBeNull();
    expect(context.board.list<WorkQueue>('work_queue')).toEqual([]);
    expect(await readdir(join(context.directory, 'chat-attachments'))).toEqual([]);
    context.addMessage = message;
    let receiptAtAbort: ChatRequest | null = null;
    controller.signal.addEventListener('abort', () => {
      receiptAtAbort = chatSubmissionReceipt(context, 'scout', input.clientRequestId);
    });
    const accepted = await sendConversation(context, 'scout', input);
    expect(accepted.order).toBeLessThan(earlier.order);
    expect(publishedInsideTransaction.length).toBeGreaterThan(0);
    expect(publishedInsideTransaction.every((inside) => !inside)).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    expect(receiptAtAbort).toMatchObject({ id: accepted.id });
    expect(context.board.get<UserInputRequest>('user_input', question.id).status).toBe('cancelled');
    expect(context.queueChains.has('conversation:scout')).toBe(false);
    const nextController = new AbortController();
    context.controllers.set(run.id, nextController);
    await sendConversation(context, 'scout', input);
    expect(nextController.signal.aborted).toBe(false);
    expect(await readdir(join(context.directory, 'chat-attachments'))).toHaveLength(1);
  },
);

it('rejects a changed payload both during admission and after commit, but scopes IDs to each conversation', async () => {
  const { context } = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(context.runtimeMaintenance.refreshOnRetry).mockReturnValueOnce(gate);
  const clientRequestId = randomUUID(),
    first = sendConversation(context, 'scout', { clientRequestId, content: 'Original' });
  await expect(
    sendConversation(context, 'scout', { clientRequestId, content: 'Changed' }),
  ).rejects.toMatchObject({ statusCode: 409 });
  release();
  await first;
  for (const changed of [
    { content: 'Changed' },
    { content: 'Original', intent: 'interrupt' },
    { content: 'Original', attachments: [{ name: 'note.txt', data: 'eA==' }] },
  ])
    await expect(
      sendConversation(context, 'scout', { clientRequestId, ...changed }),
    ).rejects.toMatchObject({ statusCode: 409 });
  await sendConversation(context, 'writer', { clientRequestId, content: 'Independent' });
  expect(context.board.list<ChatRequest>('chat_request')).toHaveLength(2);
});

const gateAdmission = (context: CrewContext) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.mocked(context.runtimeMaintenance.refreshOnRetry).mockReturnValueOnce(gate);
  const reached = () =>
    vi.waitFor(() => expect(context.runtimeMaintenance.refreshOnRetry).toHaveBeenCalled());
  return { release, reached };
};

it('accepts a send when only conversation activity changed during admission', async () => {
  const { context } = await fixture();
  const { release, reached } = gateAdmission(context);
  const sent = sendConversation(context, 'scout', {
    content: 'Hello',
    attachments: [{ name: 'note.txt', data: 'eA==' }],
  });
  await reached();
  context.addMessage('scout', 'scout', 'user', 'A reply saved meanwhile.', null, null);
  release();
  const request = await sent;
  expect(request.deliveries).toHaveLength(1);
  expect(context.board.list<ChatRequest>('chat_request')).toHaveLength(1);
  expect(await readdir(join(context.directory, 'chat-attachments'))).toHaveLength(1);
});

it('still rejects a send when routing changed during admission, and removes its attachments', async () => {
  const { context } = await fixture();
  const { release, reached } = gateAdmission(context);
  const sent = sendConversation(context, 'scout', {
    content: 'Hello',
    attachments: [{ name: 'note.txt', data: 'eA==' }],
  });
  const settled = expect(sent).rejects.toThrow(/conversation changed/i);
  await reached();
  const item = context.board.get<Conversation>('conversation', 'scout');
  context.board.record(
    'conversation',
    { ...item, configurations: { scout: { model: 'another-model' } } },
    'user',
    'Changed runtime',
  );
  release();
  await settled;
  expect(context.board.list<ChatRequest>('chat_request')).toHaveLength(0);
  const stored = await readdir(join(context.directory, 'chat-attachments')).catch(() => []);
  expect(stored).toHaveLength(0);
});

it('accepts a delegation when only conversation activity changed during admission', async () => {
  const { context } = await fixture();
  context.drainTasks = vi.fn(async () => {});
  const { release, reached } = gateAdmission(context);
  const sent = sendDelegation(context, 'scout', { content: 'Compare notes', roleIds: ['writer'] });
  await reached();
  context.addMessage('scout', 'scout', 'user', 'A reply saved meanwhile.', null, null);
  release();
  const request = await sent;
  expect(request.roundId).toBeTruthy();
});

it('does not consume failed submissions, and saves a managed review and its receipt in the same transaction', async () => {
  const { context } = await fixture();
  const clientRequestId = randomUUID();
  vi.mocked(context.runtimeMaintenance.refreshOnRetry).mockRejectedValueOnce(new Error('Offline'));
  await expect(
    sendConversation(context, 'scout', { clientRequestId, content: 'Try later' }),
  ).rejects.toThrow('Offline');
  expect(chatSubmissionReceipt(context, 'scout', clientRequestId)).toBeNull();
  await sendConversation(context, 'scout', { clientRequestId, content: 'Try later' });
  // Use a job-scoped review request to exercise managed queue admission without provider work.
  const card = context.board.createCard({
    company: 'Fictional',
    title: 'Engineer',
    location: '',
    salary: '',
    url: '',
    description: 'Build interfaces.',
    tags: [],
  });
  const thread = context.board.get<Conversation>('conversation', 'reviewer');
  context.board.record(
    'conversation',
    { ...thread, cardId: card.id },
    'user',
    'Attach fictional job',
  );
  const input = { clientRequestId: randomUUID(), content: '/hiring-panel' };
  const review = await sendConversation(context, 'reviewer', input);
  expect(review.deepReviewRequest?.cardId).toBe(card.id);
  expect((await sendConversation(context, 'reviewer', input)).id).toBe(review.id);
  expect(context.board.list<ChatMessage>('message')).toHaveLength(2);
  context.board.record('conversation', { ...thread, cardId: null }, 'user', 'Unlink fictional job');
  const selectionInput = { clientRequestId: randomUUID(), content: '/hiring-panel' };
  const selection = await sendConversation(context, 'reviewer', selectionInput);
  expect(selection.deliveries[0].status).toBe('waiting');
  expect((await sendConversation(context, 'reviewer', selectionInput)).id).toBe(selection.id);
  expect(context.board.list<UserInputRequest>('user_input')).toHaveLength(1);
  expect(context.board.list<Run>('run')).toHaveLength(1);
  expect(context.board.list<ChatMessage>('message')).toHaveLength(4);
});

it('retains accepted bytes and continues later interrupt effects when publication fails after commit', async () => {
  const { context } = await fixture();
  const run: Run = {
    id: randomUUID(),
    cardId: null,
    roleId: 'scout',
    runtime: 'codex',
    status: 'running',
    message: 'Working',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    threadId: 'scout',
    mode: 'chat',
  };
  context.board.record('run', run, 'scout', 'Started');
  const controller = new AbortController();
  context.controllers.set(run.id, controller);
  const input = {
    clientRequestId: randomUUID(),
    intent: 'interrupt',
    content: 'Keep accepted bytes',
    attachments: [{ name: 'note.txt', data: 'eA==' }],
  };
  context.publishChat = () => {
    throw new Error('Notification failed');
  };
  const accepted = await sendConversation(context, 'scout', input);
  expect(controller.signal.aborted).toBe(true);
  const receipt = chatSubmissionReceipt(context, 'scout', input.clientRequestId)!;
  expect(receipt.id).toBe(accepted.id);
  expect(receipt).not.toBeNull();
  expect((await readAttachment(context.directory, receipt.attachments[0])).toString()).toBe('x');
  expect((await sendConversation(context, 'scout', input)).id).toBe(receipt.id);
  expect(context.board.list<ChatMessage>('message')).toHaveLength(1);
});
