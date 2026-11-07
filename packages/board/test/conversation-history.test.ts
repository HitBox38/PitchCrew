import {
  Board,
  conversationHistory,
  searchConversationMessages,
  workspaceMessages,
} from '../src/index.ts';
import { transcriptItems } from '../../ui/src/ChatTurn/helpers.ts';
import type { AgentTask, ChatRequest, ChatMessage, Conversation, Run } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const message = (i: number, patch: Partial<ChatMessage> = {}): ChatMessage => {
  const m: ChatMessage = {
    id: randomUUID(),
    threadId: 'scout',
    from: i % 2 ? 'scout' : 'user',
    to: 'user',
    content: `Message ${i} ` + 'x'.repeat(4000),
    cardId: null,
    runId: null,
    createdAt: '2026-10-17T00:00:00.000Z',
    ...patch,
  };
  board.record('message', m, 'scout', 'Fixture');
  return m;
};

let board: Board;
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-history-'));
  board = new Board(join(directory, 'board.db'));
});
afterEach(async () => {
  board.close();
  await rm(directory, { recursive: true, force: true });
});
it('pages every message and turn in the same order as the existing transcript, including timestamp ties', () => {
  const messages = Array.from({ length: 121 }, (_, i) => message(i));
  const run: Run = {
    id: randomUUID(),
    roleId: 'scout',
    runtime: 'claude-code',
    threadId: 'scout',
    mode: 'chat',
    cardId: null,
    status: 'completed',
    startedAt: '2026-10-17T00:00:01.000Z',
    finishedAt: null,
    message: '',
    activity: [
      {
        id: 'activity',
        kind: 'commentary',
        label: 'Thinking',
        text: 'Fictional',
        status: 'completed',
        startedAt: '',
        finishedAt: '',
      },
    ],
  };
  messages[0] = message(0, { ...messages[0], runId: run.id });
  board.record('run', run, 'scout', 'Fixture');
  message(999, { threadId: 'writer' });
  const expected = transcriptItems(messages, [run], 'scout');
  const page = conversationHistory(board, 'scout');
  expect(page.total).toBe(expected.length);
  expect(page.items).toEqual(expected.slice(-50));
  const get = vi.spyOn(board, 'get');
  let current = page;
  // Walk explicit anchors forward, checking complete reachability without duplicate windows.
  const first = conversationHistory(board, 'scout', expected[0].id);
  const seen = [...first.items];
  current = first;
  while (current.newer) {
    current = conversationHistory(board, 'scout', current.newer);
    seen.push(...current.items);
  }
  expect(seen).toEqual(expected);
  expect(get.mock.calls.every(([kind]) => kind === 'message' || kind === 'run')).toBe(true);
  expect(conversationHistory(board, 'scout', page.older!).items).toEqual(expected.slice(22, 72));
});
it('keeps an older page anchored when new messages arrive', () => {
  const messages = Array.from({ length: 120 }, (_, i) => message(i, { from: 'user' }));
  const page = conversationHistory(board, 'scout', messages[20].id);
  message(121, { from: 'user', createdAt: '2026-10-18T00:00:00.000Z' });
  expect(conversationHistory(board, 'scout', messages[20].id).items).toEqual(page.items);
  expect(conversationHistory(board, 'empty').items).toEqual([]);
});
it('bounds previews and notifications while preserving unread metadata and searching all history', () => {
  const conversation: Conversation = {
    id: 'scout',
    title: 'Scout',
    kind: 'direct',
    participants: ['scout'],
    leadId: 'scout',
    cardId: null,
    createdBy: 'user',
    createdAt: '',
    updatedAt: '',
    archived: false,
    pinned: false,
    configurations: {},
  };
  board.record('conversation', conversation, 'user', 'Fixture');
  message(0, {
    from: 'scout',
    content: 'Early unique ÁRVÍZ marker',
    attachments: [
      {
        id: randomUUID(),
        name: 'Old Résumé.txt',
        mimeType: 'text/plain',
        size: 1,
        sha256: 'a'.repeat(64),
      },
    ],
  });
  for (let i = 1; i < 220; i++) message(i, { from: 'scout' });
  const latest = message(221, { from: 'user', createdAt: '2026-10-18T00:00:00.000Z' });
  const view = workspaceMessages(board);
  expect(view.messages).toHaveLength(1);
  expect(view.messages[0]).toMatchObject({ id: latest.id });
  expect(view.messages[0].content.length).toBeLessThanOrEqual(240);
  expect(view.notificationMessages).toHaveLength(100);
  expect(view.messageHistory?.threads.scout).toEqual({
    count: 221,
    incomingAt: '2026-10-17T00:00:00.000Z',
  });
  expect(searchConversationMessages(board, 'árvíz')).toEqual(['scout']);
  expect(searchConversationMessages(board, 'résumé')).toEqual(['scout']);
  expect(searchConversationMessages(board, 'missing')).toEqual([]);
});

it('uses the thread index for a selected conversation and reads at most one page of bodies', () => {
  for (let i = 0; i < 180; i++) message(i, { threadId: i % 2 ? 'scout' : 'writer' });
  const prepare = vi.spyOn(board.db, 'prepare');
  const get = vi.spyOn(board, 'get');
  conversationHistory(board, 'scout');
  expect(get.mock.calls).toHaveLength(50);
  const sql = prepare.mock.calls.map(([sql]) => sql).find((sql) => sql.includes('AS sender'))!;
  const plan = board.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all('scout') as { detail: string }[];
  expect(plan.some((item) => item.detail.includes('entities_thread'))).toBe(true);
});

it('replaces a turn’s configuration snapshot with the model and reasoning it ran with', () => {
  const run = {
    id: randomUUID(),
    roleId: 'scout',
    runtime: 'claude-code',
    threadId: 'scout',
    mode: 'chat',
    cardId: null,
    status: 'running',
    startedAt: '2026-10-17T00:00:01.000Z',
    finishedAt: null,
    message: '',
    configuration: {
      role: { id: 'scout', model: 'sonnet', reasoning: 'high', instructions: 'PRIVATE' },
      revision: 'r',
      skills: [{ id: 'skill', instructions: 'PRIVATE SKILL' }],
      skillsRevision: 's',
    },
  } as unknown as Run;
  board.record('run', run, 'scout', 'Fixture');
  const [item] = conversationHistory(board, 'scout').items;
  expect(item).toMatchObject({ kind: 'turn', run: { model: 'sonnet', reasoning: 'high' } });
  expect(JSON.stringify(item)).not.toContain('PRIVATE');
});

it('projects one logical group reply and excludes never-started requests without altering saved records', () => {
  const at = '2026-11-06T12:00:00.000Z';
  const run: Run = {
    id: 'scout-run',
    roleId: 'scout',
    runtime: 'codex',
    mode: 'chat',
    threadId: 'group',
    cardId: null,
    status: 'completed',
    message: '',
    startedAt: at,
    finishedAt: at,
    activity: [
      {
        id: 'step',
        kind: 'tool',
        label: 'Done',
        status: 'completed',
        startedAt: at,
        finishedAt: at,
      },
    ],
  };
  const canonical = message(1, {
    id: 'canonical',
    threadId: 'group',
    from: 'scout',
    to: 'user',
    runId: run.id,
    content: '@coach Here is my answer.',
    references: [{ kind: 'agent', id: 'coach', label: 'Coach', token: '@coach', start: 0, end: 6 }],
    createdAt: at,
  });
  const forward = message(2, {
    ...canonical,
    id: 'forward',
    to: 'coach',
    createdAt: '2026-11-06T12:00:00.001Z',
  });
  const repeated = message(3, {
    ...canonical,
    id: 'later-answer',
    runId: 'later-run',
    createdAt: '2026-11-06T12:00:01.000Z',
  });
  const unsent = message(4, {
    id: 'unsent',
    threadId: 'group',
    from: 'user',
    content: 'Unsent follow-up',
    createdAt: at,
  });
  const partial = message(5, { id: 'partial', threadId: 'group', from: 'user', createdAt: at });
  const request: ChatRequest = {
    id: 'pending',
    threadId: 'group',
    messageId: unsent.id,
    content: unsent.content,
    attachments: [],
    createdAt: at,
    order: 0,
    deliveries: [{ roleId: 'coach', status: 'paused', runId: null, error: '' }],
  };
  const delivered = {
    ...request,
    id: 'delivered',
    messageId: partial.id,
    deliveries: [
      { roleId: 'coach', status: 'completed' as const, runId: 'coach-run', error: '' },
      ...request.deliveries,
    ],
  };
  const task: AgentTask = {
    id: 'task',
    parentRunId: run.id,
    rootRunId: run.id,
    roleId: 'coach',
    threadId: 'group',
    content: canonical.content,
    cardId: null,
    mode: 'chat',
    trigger: 'message',
    status: 'queued',
    runId: null,
    error: '',
    createdAt: forward.createdAt,
  };
  board.record('run', run, 'scout', 'Fixture');
  board.record('task', task, 'scout', 'Fixture');
  board.record('chat_request', request, 'user', 'Fixture');
  board.record('chat_request', delivered, 'user', 'Fixture');
  const messages = [canonical, forward, repeated, unsent, partial];
  const expected = transcriptItems(messages, [run], 'group', {
    requests: [request, delivered],
    tasks: [task],
  });
  expect(conversationHistory(board, 'group').items).toEqual(expected);
  expect(expected.map((item) => item.id)).toEqual([
    'partial',
    'turn-scout-run',
    'canonical',
    'later-answer',
  ]);
  expect(board.list<ChatMessage>('message')).toHaveLength(5);
  expect(board.get<AgentTask>('task', task.id)).toEqual(task);
  expect(searchConversationMessages(board, 'Unsent follow-up')).toEqual(['group']);
});

it('keeps settled turns beside their answer across history page boundaries and includes silent failures', () => {
  const messages = Array.from({ length: 54 }, (_, index) =>
    message(index, {
      from: 'user',
      createdAt: new Date(Date.UTC(2026, 10, 6, 12, 0, index)).toISOString(),
    }),
  );
  const run: Run = {
    id: 'paired',
    roleId: 'scout',
    runtime: 'codex',
    mode: 'chat',
    threadId: 'scout',
    cardId: null,
    status: 'failed',
    startedAt: messages[0].createdAt,
    finishedAt: null,
    message: 'Runtime exited.',
  };
  const reply = message(49, { ...messages[49], from: 'scout', to: 'user', runId: run.id });
  messages[49] = reply;
  board.record('run', run, 'scout', 'Fixture');
  const expected = transcriptItems(messages, [run], 'scout');
  const first = conversationHistory(board, 'scout', messages[0].id);
  expect(first.items).toEqual(expected.slice(0, 51));
  expect(first.items.slice(-2).map((item) => item.id)).toEqual(['turn-paired', reply.id]);
  const second = conversationHistory(board, 'scout', first.newer!);
  expect([...first.items, ...second.items]).toEqual(expected);
  board.record('run', { ...run, id: 'silent-failure' }, 'scout', 'Fixture');
  expect(conversationHistory(board, 'scout', 'turn-silent-failure').items).toContainEqual(
    expect.objectContaining({ id: 'turn-silent-failure' }),
  );
});
