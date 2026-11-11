import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ChatRequest, Run } from '@pitchcrew/core';
import { createDaemon } from '../src/server.ts';
import { isolateRuntimes, restoreRuntimes } from './helpers/daemon.ts';

const resources: { daemon: Awaited<ReturnType<typeof createDaemon>>; directory: string }[] = [];
const port = 23491;
// Production replay needs real initialization, without host-dependent CLI/model discovery.
beforeEach(() => isolateRuntimes());
const fixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-http-receipts-'));
  const start = () => createDaemon({ directory, port, dev: false, ui: false, seedSkills: false });
  const resource = { directory, daemon: await start() };
  resources.push(resource);
  const origin = await resource.daemon.app.inject({
    url: '/',
    headers: { host: `127.0.0.1:${port}` },
  });
  const headers = {
    host: `127.0.0.1:${port}`,
    'x-pitchcrew-client': 'ui',
    cookie: String(origin.headers['set-cookie']).split(';')[0],
  };
  return { resource, start, headers };
};
afterEach(async () => {
  vi.restoreAllMocks();
  restoreRuntimes();
  for (const { daemon, directory } of resources.splice(0)) {
    await daemon.close();
    expect(directory.startsWith(join(tmpdir(), 'pitchcrew-http-receipts-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  }
});

it('protects receipt lookup, disables caching, validates identifiers and preserves Fastify conflict responses', async () => {
  const {
    resource: { daemon },
    headers,
  } = await fixture();
  const id = randomUUID();
  const payload = { content: 'Original', references: [], attachments: [], intent: 'queue' };
  const request: ChatRequest = {
    id: randomUUID(),
    threadId: 'scout',
    messageId: randomUUID(),
    content: payload.content,
    attachments: [],
    createdAt: new Date().toISOString(),
    order: 1,
    deliveries: [],
    submission: { id, digest: createHash('sha256').update(JSON.stringify(payload)).digest('hex') },
  };
  daemon.service.board.record('chat_request', request, 'user', 'Saved receipt fixture');
  const url = `/api/conversations/scout/messages/receipts/${id}`;
  expect((await daemon.app.inject({ url, headers: { host: headers.host } })).statusCode).toBe(403);
  expect(
    (await daemon.app.inject({ url, headers: { host: headers.host, cookie: headers.cookie } }))
      .statusCode,
  ).toBe(403);
  const accepted = await daemon.app.inject({ url, headers });
  expect(accepted.statusCode).toBe(200);
  expect(accepted.headers['cache-control']).toBe('no-store');
  expect(accepted.json()).toEqual({
    request: { id: request.id, threadId: request.threadId, submission: { id } },
  });
  expect(
    (
      await daemon.app.inject({
        url: '/api/conversations/scout/messages/receipts/not-a-uuid',
        headers,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await daemon.app.inject({
        url: `/api/conversations/${randomUUID()}/messages/receipts/${id}`,
        headers,
      })
    ).statusCode,
  ).toBe(400);
  const missing = await daemon.app.inject({
    url: `/api/conversations/scout/messages/receipts/${randomUUID()}`,
    headers,
  });
  expect(missing.json()).toEqual({ request: null });
  const conflict = await daemon.app.inject({
    method: 'POST',
    url: '/api/conversations/scout/messages',
    headers,
    payload: { clientRequestId: id, content: 'Changed' },
  });
  expect(conflict.statusCode).toBe(409);
  const replay = await daemon.app.inject({
    method: 'POST',
    url: '/api/conversations/scout/messages',
    headers,
    payload: { clientRequestId: id, content: 'Original' },
  });
  expect(replay.statusCode).toBe(202);
  expect(replay.json()).toEqual(request);
  expect(daemon.service.board.list('run')).toEqual([]);
});

it('recovers durable checkpoint activity through production initialize and event replay', async () => {
  const { resource, start } = await fixture();
  const run: Run = {
    id: randomUUID(),
    roleId: 'scout',
    cardId: null,
    threadId: 'scout',
    mode: 'chat',
    runtime: 'codex',
    status: 'running',
    message: 'Interrupted fixture',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  resource.daemon.service.board.record('run', run, 'scout', 'Started fixture');
  resource.daemon.service.board.db
    .prepare('INSERT INTO run_activity_checkpoints (run_id,json) VALUES (?,?)')
    .run(
      run.id,
      JSON.stringify({
        entries: [
          {
            id: 'profile-step',
            kind: 'tool',
            label: 'Reading profile',
            status: 'running',
            startedAt: run.startedAt,
            finishedAt: null,
          },
        ],
        truncated: false,
      }),
    );
  await resource.daemon.close();
  resource.daemon = await start();
  const recovered = resource.daemon.service.board.get<Run>('run', run.id);
  expect(recovered).toMatchObject({
    status: 'failed',
    activity: [
      {
        id: 'profile-step',
        status: 'interrupted',
        startedAt: run.startedAt,
        finishedAt: expect.any(String),
      },
    ],
  });
  expect(
    resource.daemon.service.board.db
      .prepare('SELECT COUNT(*) AS count FROM run_activity_checkpoints')
      .get(),
  ).toEqual({ count: 0 });
  resource.daemon.service.board.rebuild();
  expect(resource.daemon.service.board.get<Run>('run', run.id).activity).toEqual(
    recovered.activity,
  );
  expect(
    resource.daemon.service.board
      .history(run.id)
      .filter((event) => event.message === 'Saved turn activity'),
  ).toHaveLength(1);
});
