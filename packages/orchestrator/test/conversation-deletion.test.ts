import { randomUUID } from 'node:crypto';
import { afterEach, expect, it } from 'vitest';
import type {
  AgentMemory,
  AgentTask,
  ChatMessage,
  ChatRequest,
  Conversation,
  Routine,
  Run,
  Snapshot,
} from '@pitchcrew/core';
import { currentEventVersion } from '@pitchcrew/core';
import { setup, cleanup } from './helpers/daemon.ts';
import { migrateConversations } from '../src/crew/conversations.ts';

afterEach(cleanup);
const fixture = () => setup(19549);

it('deletes transcripts, previews, searches and sessions while preserving history and other chats across replay', async () => {
  const { daemon, request } = await fixture();
  const { board } = daemon.service;
  const item = daemon.service.createConversation({
    title: 'Fictional planning',
    participants: ['scout'],
  });
  const message = daemon.service.addMessage(
    item.id,
    'user',
    'scout',
    'Unique deleted phrase',
    null,
    null,
  );
  const other = daemon.service.addMessage(
    'writer',
    'user',
    'writer',
    'Keep this message',
    null,
    null,
  );
  board.record(
    'conversation_session',
    {
      id: randomUUID(),
      threadId: item.id,
      roleId: 'scout',
      nativeId: null,
      directoryId: randomUUID(),
      runtime: 'demo',
      revision: 'fixture',
      lastMessageId: message.id,
      invalid: false,
    },
    'system',
    'Fixture session',
  );
  const count = board.events(10000).length;
  expect((await request(`/conversations/${item.id}`, 'DELETE')).response.status).toBe(200);
  expect(board.events(10000)).toHaveLength(count + 1);
  expect(board.events()[0]).toMatchObject({
    version: currentEventVersion,
    actor: 'user',
    data: { deletedAt: expect.any(String) },
  });
  for (const rebuild of [false, true]) {
    if (rebuild) board.rebuild();
    const full = (await request<Snapshot>('/snapshot')).result;
    const compact = (await request<Snapshot>('/snapshot?view=workspace')).result;
    expect(full.conversations?.some((c) => c.id === item.id)).toBe(false);
    expect(full.messages.some((m) => m.id === message.id)).toBe(false);
    expect(full.messages.some((m) => m.id === other.id)).toBe(true);
    expect(compact.messageHistory?.threads[item.id]).toBeUndefined();
    expect(board.list('conversation_session')).toHaveLength(0);
    expect(
      (await request<{ threads: string[] }>('/conversations/search?q=Unique%20deleted')).result
        .threads,
    ).not.toContain(item.id);
    expect((await request(`/conversations/${item.id}/history`)).response.status).toBe(400);
    expect(
      (await request(`/conversations/${item.id}`, 'PUT', { archived: false })).response.status,
    ).toBe(400);
    expect(
      (await request(`/conversations/${item.id}/messages`, 'POST', { content: 'Revive' })).response
        .status,
    ).toBe(400);
  }
  expect(board.history(message.id)).toHaveLength(1);
  // Late writes cannot recreate a deleted conversation or its transcript projection.
  board.record('conversation', item, 'system', 'Late update');
  board.record('message', message, 'system', 'Late message');
  expect(board.list<Conversation>('conversation').some((c) => c.id === item.id)).toBe(false);
  expect(board.list<ChatMessage>('message').some((m) => m.id === message.id)).toBe(false);
});

it('cancels queued work, pauses routines and retains separately saved memories', async () => {
  const { daemon, request } = await fixture();
  const { board } = daemon.service;
  const item = daemon.service.createConversation({
    title: 'Fictional queued chat',
    participants: ['scout'],
  });
  const now = new Date().toISOString();
  const task: AgentTask = {
    id: randomUUID(),
    parentRunId: randomUUID(),
    rootRunId: randomUUID(),
    roleId: 'scout',
    cardId: null,
    mode: 'chat',
    trigger: 'invoke',
    threadId: item.id,
    content: 'Pending work',
    status: 'queued',
    runId: null,
    error: '',
    createdAt: now,
  };
  const queued: ChatRequest = {
    id: randomUUID(),
    messageId: randomUUID(),
    threadId: item.id,
    content: 'Pending reply',
    attachments: [],
    createdAt: now,
    order: Date.now(),
    deliveries: [{ roleId: 'scout', status: 'paused', runId: null, error: '' }],
  };
  board.record('task', task, 'system', 'Fixture follow-up');
  board.record('chat_request', queued, 'user', 'Fixture queue');
  const routine = (
    await request<Routine>('/routines', 'POST', {
      name: 'Fictional routine',
      roleId: 'scout',
      content: 'Review topic',
      conversationId: item.id,
      startAt: '2035-01-01T09:00:00Z',
      timezone: 'UTC',
    })
  ).result;
  const memory: AgentMemory = {
    id: randomUUID(),
    roleId: 'scout',
    content: 'Saved decision',
    tags: [],
    source: { threadId: item.id },
    updatedAt: now,
    deleted: false,
  };
  board.record('agent_memory', memory, 'scout', 'Fixture memory');
  expect((await request(`/conversations/${item.id}`, 'DELETE')).response.status).toBe(200);
  expect(board.get<AgentTask>('task', task.id).status).toBe('cancelled');
  expect(board.history(queued.id)[0].data).toMatchObject({ deliveries: [{ status: 'cancelled' }] });
  expect(board.list<ChatRequest>('chat_request')).toHaveLength(0);
  expect(board.get<Routine>('routine', routine.id)).toMatchObject({
    enabled: false,
    nextRunAt: null,
  });
  expect(board.get<AgentMemory>('agent_memory', memory.id)).toEqual(memory);
});

it('does not recreate deleted default chats during startup migration or legacy sends', async () => {
  const { daemon, request } = await fixture();
  for (const id of ['scout', 'crew'])
    expect((await request(`/conversations/${id}`, 'DELETE')).response.status).toBe(200);
  daemon.service.board.rebuild();
  migrateConversations({ board: daemon.service.board });
  for (const id of ['scout', 'crew'])
    expect(() => daemon.service.board.get('conversation', id)).toThrow('not found');
  expect(
    (await request('/roles/scout/chat', 'POST', { content: 'Revive deleted chat' })).response
      .status,
  ).toBe(400);
  expect(
    (await request('/conversations', 'POST', { title: 'New Scout chat', participants: ['scout'] }))
      .response.status,
  ).toBe(201);
});

it('rejects deletion atomically during active or waiting work, including child work', async () => {
  const { daemon, request } = await fixture();
  const { board } = daemon.service;
  const item = daemon.service.createConversation({ title: 'Busy topic', participants: ['scout'] });
  const root: Run = {
    id: randomUUID(),
    cardId: null,
    roleId: 'scout',
    runtime: 'demo',
    status: 'completed',
    message: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    threadId: item.id,
    mode: 'chat',
  };
  board.record('run', root, 'system', 'Fixture root');
  const child = {
    ...root,
    id: randomUUID(),
    threadId: 'writer',
    rootRunId: root.id,
    status: 'running' as const,
  };
  for (const status of ['running', 'waiting'] as const) {
    board.record('run', { ...child, status }, 'system', 'Fixture child');
    const count = board.events(10000).length;
    expect((await request(`/conversations/${item.id}`, 'DELETE')).response.status).toBe(400);
    expect(board.events(10000)).toHaveLength(count);
    expect(board.get<Conversation>('conversation', item.id).deletedAt).toBeUndefined();
  }
  board.record('run', { ...child, status: 'completed' }, 'system', 'Finished child');
  expect((await request(`/conversations/${item.id}`, 'DELETE')).response.status).toBe(200);
});
