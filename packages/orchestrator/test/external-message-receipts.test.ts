import { afterEach, expect, it, vi } from 'vitest';
import { Board } from '@pitchcrew/board';
import type { ChatMessage, ChatRequest, ExternalMcpInfo } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enableExternalAccess, readExternalAccess } from '@pitchcrew/mcp/external/access';
import { externalCall } from '../src/external/gateway.ts';
import { addMessage } from '../src/crew/chat.ts';
import { migrateConversations } from '../src/crew/conversations.ts';
import type { CrewContext } from '../src/crew/types.ts';
import { createDaemon } from '../src/server.ts';
import { isolateRuntimes, restoreRuntimes } from './helpers/daemon.ts';

const resources: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of resources.splice(0).reverse()) await close();
  vi.restoreAllMocks();
  restoreRuntimes();
});

it('coalesces external sends by client ID, preserves attribution and returns only receipt identity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-external-receipts-'));
  const board = new Board(join(directory, 'board.sqlite'));
  resources.push(async () => {
    board.close();
    expect(directory.startsWith(join(tmpdir(), 'pitchcrew-external-receipts-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  });
  const context = {
    directory,
    board,
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
  board.seedRoles('codex', true);
  migrateConversations(context);
  const input = {
    conversationId: 'scout',
    content: 'Read this fictional role.',
    clientRequestId: randomUUID(),
  };
  const receipt = () =>
    externalCall(context, 'read_message_receipt', {
      conversationId: input.conversationId,
      clientRequestId: input.clientRequestId,
    });
  expect(await receipt()).toEqual({ request: null });
  const [first, duplicate] = await Promise.all([
    externalCall(context, 'send_message', input),
    externalCall(context, 'send_message', input),
  ]);
  const sent = first.request as ChatRequest;
  expect(duplicate).toEqual(first);
  expect(board.list<ChatRequest>('chat_request')).toHaveLength(1);
  expect(board.list<ChatMessage>('message')).toHaveLength(1);
  expect(board.get<ChatMessage>('message', sent.messageId).content).toBe(
    '[External MCP agent]\nRead this fictional role.',
  );
  expect(await receipt()).toEqual({
    request: { id: sent.id, threadId: 'scout', submission: { id: input.clientRequestId } },
  });
  expect(await externalCall(context, 'send_message', input)).toEqual(first);
  await expect(
    externalCall(context, 'send_message', { ...input, content: 'Different' }),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(
    await externalCall(context, 'read_message_receipt', {
      conversationId: 'writer',
      clientRequestId: input.clientRequestId,
    }),
  ).toEqual({ request: null });
  await expect(
    externalCall(context, 'read_message_receipt', {
      conversationId: 'scout',
      clientRequestId: 'invalid',
    }),
  ).rejects.toThrow();
  await externalCall(context, 'send_message', { conversationId: 'scout', content: input.content });
  expect(board.list<ChatRequest>('chat_request')).toHaveLength(2);
  expect(board.list('run')).toEqual([]);
});

it('allows read-only receipt reconciliation and records only successful requests for the current access grant', async () => {
  isolateRuntimes();
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-external-bridge-'));
  resources.push(async () => {
    expect(directory.startsWith(join(tmpdir(), 'pitchcrew-external-bridge-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  });
  const daemon = await createDaemon({
    directory,
    port: 23492,
    dev: false,
    ui: false,
    seedSkills: false,
  });
  resources.push(() => daemon.close());
  const host = '127.0.0.1:23492';
  const root = await daemon.app.inject({ url: '/', headers: { host } });
  const uiHeaders = {
    host,
    'x-pitchcrew-client': 'ui',
    cookie: String(root.headers['set-cookie']).split(';')[0],
  };
  const info = async () => {
    const response = await daemon.app.inject({
      url: '/api/external-mcp/access',
      headers: uiHeaders,
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    return response.json<ExternalMcpInfo>();
  };
  expect(await info()).toMatchObject({ lastRequest: null, lastAttempt: null });
  await enableExternalAccess(directory);
  const access = (await readExternalAccess(directory))!;
  const headers = { host, authorization: `Bearer ${access.token}` };
  const call = (action: string, input: Record<string, unknown> = {}) =>
    daemon.app.inject({
      method: 'POST',
      url: '/api/external-mcp',
      headers,
      payload: { action, input },
    });
  expect((await info()).lastRequest).toBeNull();
  expect(
    (await call('send_message', { conversationId: 'scout', content: 'Denied' })).statusCode,
  ).toBe(403);
  expect((await info()).lastRequest).toBeNull();
  expect((await info()).lastAttempt).toEqual({
    action: 'send_message',
    at: expect.any(String),
    outcome: 'read-only',
  });
  expect((await call('status')).statusCode).toBe(200);
  const checked = await info();
  expect(checked.lastRequest).toEqual({ action: 'status', at: expect.any(String) });
  expect(checked.lastAttempt).toEqual({ ...checked.lastRequest, outcome: 'succeeded' });
  expect(Number.isNaN(Date.parse(checked.lastRequest!.at))).toBe(false);
  expect(JSON.stringify(checked)).not.toContain(access.token);
  const clientRequestId = randomUUID();
  const stored: ChatRequest = {
    id: randomUUID(),
    threadId: 'scout',
    messageId: randomUUID(),
    content: 'Private payload',
    attachments: [],
    createdAt: new Date().toISOString(),
    order: 1,
    deliveries: [],
    submission: { id: clientRequestId, digest: 'private-digest' },
  };
  daemon.service.board.record('chat_request', stored, 'user', 'Saved acceptance fixture');
  const found = await call('read_message_receipt', { conversationId: 'scout', clientRequestId });
  expect(found.statusCode).toBe(200);
  expect(found.headers['cache-control']).toBe('no-store');
  expect(found.json()).toEqual({
    request: { id: stored.id, threadId: 'scout', submission: { id: clientRequestId } },
  });
  const beforeFailure = (await info()).lastRequest;
  expect(
    (
      await call('read_message_receipt', {
        conversationId: 'scout',
        clientRequestId: 'invalid',
      })
    ).statusCode,
  ).toBe(400);
  const failed = await info();
  expect(failed.lastRequest).toEqual(beforeFailure);
  expect(failed.lastAttempt).toEqual({
    action: 'read_message_receipt',
    at: expect.any(String),
    outcome: 'failed',
  });
  expect(JSON.stringify(failed)).not.toContain('invalid');
  expect(JSON.stringify(failed)).not.toContain(stored.content);
  expect(JSON.stringify(failed)).not.toContain(access.token);
  for (const authorization of ['', 'Bearer ' + '0'.repeat(64)])
    expect(
      (
        await daemon.app.inject({
          method: 'POST',
          url: '/api/external-mcp',
          headers: { host, authorization },
          payload: { action: 'status', input: {} },
        })
      ).statusCode,
    ).toBe(403);
  expect((await call('unrecognized-action')).statusCode).toBe(400);
  expect((await info()).lastAttempt).toEqual(failed.lastAttempt);
  expect(
    (
      await daemon.app.inject({
        url: '/api/external-mcp/access',
        headers,
      })
    ).statusCode,
  ).toBe(403);
  const originalCall = daemon.service.externalCall.bind(daemon.service);
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(daemon.service, 'externalCall').mockImplementationOnce(async (action, input) => {
    entered();
    await held;
    return originalCall(action, input);
  });
  const stale = call('status');
  await started;
  try {
    await enableExternalAccess(directory);
    expect(await info()).toMatchObject({ lastRequest: null, lastAttempt: null });
    const current = (await readExternalAccess(directory))!;
    const latest = await daemon.app.inject({
      method: 'POST',
      url: '/api/external-mcp',
      headers: { host, authorization: `Bearer ${current.token}` },
      payload: { action: 'status', input: {} },
    });
    expect(latest.statusCode).toBe(200);
    const currentEvidence = await info();
    expect(currentEvidence.lastRequest).toEqual({ action: 'status', at: expect.any(String) });
    expect(currentEvidence.lastAttempt).toEqual({
      ...currentEvidence.lastRequest,
      outcome: 'succeeded',
    });
    release();
    expect((await stale).statusCode).toBe(200);
    expect(await info()).toEqual(currentEvidence);
    expect((await call('status')).statusCode).toBe(403);
    expect(await info()).toEqual(currentEvidence);
  } finally {
    release();
    await stale;
  }
  const disabled = await daemon.app.inject({
    method: 'PUT',
    url: '/api/external-mcp/access',
    headers: uiHeaders,
    payload: { enabled: false, write: false },
  });
  expect(disabled.statusCode).toBe(200);
  expect(disabled.json<ExternalMcpInfo>()).toMatchObject({ lastRequest: null, lastAttempt: null });
  expect(daemon.service.board.list('run')).toEqual([]);
});
