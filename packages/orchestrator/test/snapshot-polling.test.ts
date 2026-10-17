import type { ChatMessage, Run, Snapshot } from '@pitchcrew/core';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { mkdtemp, mkdir, rm, writeFile, unlink, rename, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCrewContext } from '../src/crew/context.ts';
import { snapshotRevision } from '../src/crew/snapshot-revision.ts';
import { registerSnapshot } from '../src/http/snapshot.ts';

let directory: string;
let context: ReturnType<typeof createCrewContext>;
let app: ReturnType<typeof Fastify>;
let snapshot: ReturnType<typeof vi.fn<() => Promise<Snapshot>>>;
const message: ChatMessage = {
  id: 'fixture',
  threadId: 'scout',
  from: 'scout',
  to: 'user',
  content: 'Fictional reply',
  cardId: null,
  runId: null,
  createdAt: '',
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pitchcrew-snapshot-test-'));
  await mkdir(join(directory, 'profile'));
  context = createCrewContext(directory, 'http://127.0.0.1:15040', '/fictional/mcp.ts', true);
  await context.snapshot(); // Finish legacy-conversation migration before capturing validators.
  snapshot = vi.fn(() => context.snapshot());
  app = Fastify();
  registerSnapshot(app, { snapshot, snapshotRevision: () => snapshotRevision(context) });
});
afterEach(async () => {
  await app.close();
  context.board.close();
  await rm(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});
const get = (etag?: string) =>
  app.inject({
    method: 'GET',
    url: '/api/snapshot',
    headers: etag ? { 'if-none-match': etag } : {},
  });

it('returns a full initial/default snapshot and skips all projection reads and serialization for unchanged polls', async () => {
  context.board.record(
    'message',
    { ...message, content: 'x'.repeat(100_000) },
    'scout',
    'Fictional answer',
  );
  const initial = await get();
  expect(initial.statusCode).toBe(200);
  expect(initial.json().messages[0].content).toHaveLength(100_000);
  expect(initial.headers['cache-control']).toBe('private, no-store');
  const list = vi.spyOn(context.board, 'list');
  const events = vi.spyOn(context.board, 'events');
  snapshot.mockClear();
  const unchanged = await get(String(initial.headers.etag));
  expect(unchanged.statusCode).toBe(304);
  expect(unchanged.body).toBe('');
  expect(snapshot).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  expect(events).not.toHaveBeenCalled();
  expect((await get()).json().messages).toEqual(initial.json().messages);
  expect(snapshot).toHaveBeenCalledTimes(1);
});

it('invalidates board changes from this connection and other SQLite connections', async () => {
  let result = await get();
  context.board.record('message', message, 'scout', 'Fictional answer');
  result = await get(String(result.headers.etag));
  expect(result.statusCode).toBe(200);
  const other = new Database(join(directory, 'pitchcrew.db'));
  try {
    other
      .prepare("UPDATE entities SET json = ? WHERE kind = 'message' AND id = ?")
      .run(JSON.stringify({ ...message, content: 'Externally updated' }), message.id);
  } finally {
    other.close();
  }
  result = await get(String(result.headers.etag));
  expect(result.statusCode).toBe(200);
  expect(result.json().messages[0].content).toBe('Externally updated');
});

it('observes every non-board input without depending on a board event', async () => {
  const run = {
    id: 'live-run',
    mode: 'chat',
    status: 'running',
    roleId: 'scout',
    cardId: null,
    threadId: 'scout',
    runtime: 'demo',
    model: 'demo',
    message: '',
    startedAt: '',
    finishedAt: null,
  } as Run;
  context.board.record('run', run, 'scout', 'Fictional run');
  const scout = context.board.get<import('@pitchcrew/core').Role>('role', 'scout');
  context.board.record(
    'role',
    {
      ...scout,
      instructions:
        'Evaluate the provided job against the profile. Explain the fit. Never invent jobs or qualifications.',
    },
    'system',
    'Fictional earlier shipped instructions',
  );
  const scoutRevision = context.board
    .defaultInstructionStatuses()
    .find((entry) => entry.roleId === 'scout')!.revision;
  const events = context.board.events().length;
  const changes: [string, () => unknown | Promise<unknown>, (data: Snapshot) => unknown][] = [
    [
      'onboarding',
      () => context.onboarding.save({ version: 1, status: 'completed', step: 1 }),
      (data) => expect(data.onboarding?.status).toBe('completed'),
    ],
    [
      'organization',
      () => context.profileOrganization.change({ action: 'create', path: 'Projects' }),
      (data) => expect(data.profileOrganization?.folders).toEqual(['Projects']),
    ],
    [
      'instruction dismissal',
      () => context.instructionUpdatePreferences.dismiss('scout', scoutRevision),
      (data) =>
        expect(data.instructionUpdates?.find((entry) => entry.roleId === 'scout')?.dismissed).toBe(
          true,
        ),
    ],
    [
      'packet rules',
      () => writeFile(join(directory, 'packet-rules.json'), 'invalid json'),
      (data) => expect(data.packetRules?.error).toContain('JSON'),
    ],
    [
      'runtime health',
      () => {
        context.runtimes = [
          {
            id: 'demo',
            available: true,
            version: 'fixture',
            detail: '',
            models: [],
            modelSource: 'none',
            modelDetail: '',
          },
        ];
      },
      (data) => expect(data.runtimes[0].available).toBe(true),
    ],
    [
      'model catalog',
      () => {
        context.runtimes[0].models = [{ value: 'fixture', label: 'Fixture' }];
      },
      (data) => expect(data.runtimes[0].models[0].value).toBe('fixture'),
    ],
    [
      'connector transition',
      () =>
        vi.spyOn(context.connectors, 'status').mockReturnValue([
          {
            id: 'github',
            connected: false,
            pending: true,
            account: '',
            services: [],
            configured: true,
            error: '',
          },
        ]),
      (data) => expect(data.connectors[0].pending).toBe(true),
    ],
    [
      'starter errors',
      () => {
        context.starterSkillErrors = [{ name: 'fixture', error: 'Offline fixture' }];
      },
      (data) => expect(data.starterSkillErrors).toHaveLength(1),
    ],
    [
      'stream token',
      () => context.streamingMessages.set('fixture', message),
      (data) => expect(data.streamingMessages).toEqual([message]),
    ],
    [
      'activity',
      () => context.runActivities.set(run.id, { entries: [], truncated: false }),
      (data) => expect(data.activityRuns).toHaveLength(1),
    ],
    [
      'activity truncation',
      () => {
        context.runActivities.get(run.id)!.truncated = true;
      },
      (data) => expect(data.activityRuns![0].activityTruncated).toBe(true),
    ],
    [
      'external note',
      () => writeFile(join(directory, 'profile', 'note.md'), 'Fictional note'),
      (data) => expect(data.profile[0].content).toBe('Fictional note'),
    ],
    [
      'same-size note edit',
      () => writeFile(join(directory, 'profile', 'note.md'), 'Different note'),
      (data) => expect(data.profile[0].content).toBe('Different note'),
    ],
    [
      'renamed note',
      () => rename(join(directory, 'profile', 'note.md'), join(directory, 'profile', 'other.md')),
      (data) => expect(data.profile[0].name).toBe('other.md'),
    ],
    [
      'removed note',
      () => unlink(join(directory, 'profile', 'other.md')),
      (data) => expect(data.profile).toEqual([]),
    ],
  ];
  let result = await get();
  for (const [name, change, verify] of changes) {
    await change();
    result = await get(String(result.headers.etag));
    expect(result.statusCode, name).toBe(200);
    verify(result.json());
    expect((await get(String(result.headers.etag))).statusCode, name).toBe(304);
  }
  expect(context.board.events()).toHaveLength(events);
});

it('does not label an asynchronous snapshot with a newer state than it contains', async () => {
  const first = await get();
  context.board.record('message', message, 'scout', 'Fictional answer');
  const currentSnapshot = context.snapshot.bind(context);
  snapshot.mockImplementationOnce(async () => {
    const data = await currentSnapshot();
    context.onboarding.save({ version: 1, status: 'completed', step: 1 });
    return data;
  });
  const racing = await get(String(first.headers.etag));
  expect(racing.json().onboarding.status).not.toBe('completed');
  const recovered = await get(String(racing.headers.etag));
  expect(recovered.statusCode).toBe(200);
  expect(recovered.json().onboarding.status).toBe('completed');
});

it('detects same-length external note edits even when modification time is restored', async () => {
  const path = join(directory, 'profile', 'note.md');
  await writeFile(path, 'Fictional note A');
  const initial = await get();
  const before = await stat(path);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await writeFile(path, 'Fictional note B');
  await utimes(path, before.atime, before.mtime);
  const after = await get(String(initial.headers.etag));
  expect(after.statusCode).toBe(200);
  expect(after.json().profile[0].content).toBe('Fictional note B');
});

it('never accepts a validator from a previous daemon instance', async () => {
  const initial = await get();
  const restarted = Fastify();
  try {
    registerSnapshot(restarted, { snapshot, snapshotRevision: () => snapshotRevision(context) });
    const result = await restarted.inject({
      method: 'GET',
      url: '/api/snapshot',
      headers: { 'if-none-match': String(initial.headers.etag) },
    });
    expect(result.statusCode).toBe(200);
    expect(result.headers.etag).not.toBe(initial.headers.etag);
  } finally {
    await restarted.close();
  }
});

it('shares only in-flight workspace reads at the same revision', async () => {
  const body = await context.snapshot();
  let release!: (value: Snapshot) => void;
  const waiting = new Promise<Snapshot>((resolve) => {
    release = resolve;
  });
  snapshot.mockReturnValue(waiting);
  const revision = vi.fn(async () => 'unchanged');
  await app.close();
  app = Fastify();
  registerSnapshot(app, { snapshot, snapshotRevision: revision });
  const first = app.inject({ url: '/api/snapshot?view=workspace' });
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledOnce());
  const second = app.inject({ url: '/api/snapshot?view=workspace' });
  try {
    await vi.waitFor(() => expect(revision).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(snapshot).toHaveBeenCalledOnce();
  } finally {
    release(body);
  }
  const responses = await Promise.all([first, second]);
  expect(responses[0].body).toBe(responses[1].body);
  snapshot.mockResolvedValue(body);
  expect((await app.inject({ url: '/api/snapshot?view=workspace' })).statusCode).toBe(200);
  expect(snapshot).toHaveBeenCalledTimes(2);
});

it('never coalesces different revisions or retains a failed workspace build', async () => {
  const body = await context.snapshot();
  let value = 'first';
  let release!: (value: Snapshot) => void;
  snapshot.mockImplementationOnce(
    () =>
      new Promise<Snapshot>((resolve) => {
        release = resolve;
      }),
  );
  snapshot.mockResolvedValue(body);
  await app.close();
  app = Fastify();
  registerSnapshot(app, { snapshot, snapshotRevision: async () => value });
  const first = app.inject({ url: '/api/snapshot?view=workspace' });
  await vi.waitFor(() => expect(snapshot).toHaveBeenCalledOnce());
  value = 'second';
  let second;
  try {
    second = await app.inject({ url: '/api/snapshot?view=workspace' });
  } finally {
    release(body);
  }
  expect(snapshot).toHaveBeenCalledTimes(2);
  expect((await first).headers.etag).not.toBe(second.headers.etag);
  snapshot.mockRejectedValueOnce(new Error('Fictional read failure'));
  expect((await app.inject({ url: '/api/snapshot?view=workspace' })).statusCode).toBe(500);
  expect((await app.inject({ url: '/api/snapshot?view=workspace' })).statusCode).toBe(200);
  expect(snapshot).toHaveBeenCalledTimes(4);
});
