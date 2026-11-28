import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  defaultCapabilities,
  type ChatMessage,
  type ChatRequest,
  type ProfileMaintenanceProposal,
  type ProfileSource,
  type Role,
  type Run,
  type UserInputRequest,
} from '@pitchcrew/core';
import { readProfile } from '@pitchcrew/packet';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { digest } from '../../orchestrator/src/profile-sources/helpers.ts';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

type Fixture = Awaited<ReturnType<typeof setup>>;
interface EditResult {
  ok: boolean;
  name: string;
  trashId?: string;
  sync: { status: string; error?: string; commit?: string; branch?: string; url?: string };
}
const first = 'a'.repeat(40);
const second = 'b'.repeat(40);
const commit = 'c'.repeat(40);
const original = 'Built the fictional Atlas scheduling tool.';
const revised = 'Led frontend development of the fictional Atlas scheduling tool.';
const endings: (() => void)[] = [];

const active = (
  f: Fixture,
  {
    run: runPatch = {},
    request: requestPatch = {},
    message: messagePatch = {},
    editProfile = true,
    github = false,
  }: {
    run?: Partial<Run>;
    request?: Partial<ChatRequest>;
    message?: Partial<ChatMessage>;
    editProfile?: boolean;
    github?: boolean;
  } = {},
) => {
  const board = f.daemon.service.board;
  const role = board.get<Role>('role', 'documenter');
  board.record(
    'role',
    {
      ...role,
      capabilities: { ...defaultCapabilities, editProfile, github },
    },
    'user',
    'Fictional profile editor permissions',
  );
  const runId = randomUUID();
  const requestId = randomUUID();
  const message: ChatMessage = {
    id: randomUUID(),
    threadId: role.id,
    from: 'user',
    to: role.id,
    content: 'Update my fictional profile notes with the corrections I provided.',
    cardId: null,
    runId: null,
    createdAt: new Date().toISOString(),
    ...messagePatch,
  };
  const run: Run = {
    id: runId,
    roleId: role.id,
    cardId: null,
    runtime: 'demo',
    status: 'running',
    message: 'Fictional profile edit',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    mode: 'chat',
    threadId: role.id,
    requestId,
    ...runPatch,
  };
  const request: ChatRequest = {
    id: requestId,
    threadId: role.id,
    messageId: message.id,
    content: message.content,
    attachments: [],
    createdAt: message.createdAt,
    order: 0,
    deliveries: [{ roleId: role.id, runId, status: 'running', error: '' }],
    ...requestPatch,
  };
  board.record('message', message, 'user', 'Fictional direct request');
  board.record('chat_request', request, 'user', 'Fictional request delivery');
  board.record('run', run, role.id, 'Fictional active turn');
  const controller = new AbortController();
  f.daemon.service.controllers.set(runId, controller);
  const token = randomUUID();
  f.daemon.service.capabilities.set(token, { runId, roleId: role.id, cardId: null });
  const end = () => {
    f.daemon.service.controllers.delete(runId);
    f.daemon.service.capabilities.delete(token);
    const current = board.get<Run>('run', runId);
    board.record('run', { ...current, status: 'completed' }, role.id, 'Fictional turn ended');
  };
  endings.push(end);
  return { token, run, request, message, controller };
};

const agent = async <T = EditResult>(
  f: Fixture,
  token: string,
  action: string,
  input: unknown = {},
) => {
  const response = await fetch(`${f.daemon.url}/api/agent`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action, input }),
  });
  return { response, result: (await response.json()) as T };
};
const update = (f: Fixture, token: string, input: unknown) =>
  agent(f, token, 'update_profile', input);

const profileSource = (patch: Partial<ProfileSource> = {}): ProfileSource => ({
  id: 'a'.repeat(24),
  input: { provider: 'github', repository: 'fictional/profile', path: 'notes', ref: 'dev' },
  label: 'Fictional profile notes',
  importedAt: '2026-11-01T00:00:00.000Z',
  watching: false,
  files: [
    {
      key: 'notes/background.md',
      name: 'background.md',
      path: 'notes/background.md',
      url: `https://github.com/fictional/profile/blob/${first}/notes/background.md`,
      revision: first,
      digest: digest(original),
    },
  ],
  ...patch,
});
const attach = async (f: Fixture, sources = [profileSource()]) => {
  await writeFile(join(f.directory, 'profile-sources.json'), JSON.stringify(sources), 'utf8');
  return sources;
};
const connected = (f: Fixture) =>
  vi.spyOn(f.daemon.service.connectors, 'status').mockReturnValue([
    {
      id: 'github',
      account: 'fictional',
      connected: true,
      services: ['github'],
      configured: true,
      pending: false,
      error: '',
    },
  ]);
const writeResult = {
  sha: second,
  commit,
  branch: 'dev',
  url: `https://github.com/fictional/profile/blob/${commit}/notes/background.md`,
};

afterEach(async () => {
  for (const end of endings.splice(0)) end();
  await cleanup();
});

describe('direct profile editing', () => {
  it('creates, edits and trashes a note through MCP stdio using current local baselines', async () => {
    const f = await setup();
    const run = active(f);
    const client = new Client({ name: 'profile-edit-test', version: '1.0.0' });
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [
            '--import',
            import.meta.resolve('tsx'),
            fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
          ],
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(
                (entry): entry is [string, string] => entry[1] !== undefined,
              ),
            ),
            PITCHCREW_DAEMON_URL: f.daemon.url,
            PITCHCREW_RUN_TOKEN: run.token,
          },
          stderr: 'pipe',
        }),
      );
      const { tools } = await client.listTools();
      const filenameInput = (toolName: string) =>
        tools.find((tool) => tool.name === toolName)?.inputSchema.properties?.name;
      expect(filenameInput('pitchcrew_update_profile')).toEqual({
        type: 'string',
        minLength: 1,
        maxLength: 100,
      });
      expect(filenameInput('pitchcrew_propose_profile_note')).toEqual({
        type: 'string',
        maxLength: 200,
      });
      expect(
        (await client.callTool({ name: 'pitchcrew_list_profile_edit_sources', arguments: {} }))
          .structuredContent,
      ).toMatchObject({ notes: [], sources: [] });
      const create = await client.callTool({
        name: 'pitchcrew_update_profile',
        arguments: {
          action: 'save',
          name: 'background.md',
          content: original,
          baseline: null,
        },
      });
      expect(create.isError).not.toBe(true);
      expect(create.structuredContent).toMatchObject({ ok: true, sync: { status: 'local_only' } });
      expect(
        (await client.callTool({ name: 'pitchcrew_list_profile_edit_sources', arguments: {} }))
          .structuredContent,
      ).toMatchObject({ notes: [{ name: 'background.md', baseline: digest(original) }] });
      const edit = await client.callTool({
        name: 'pitchcrew_update_profile',
        arguments: {
          action: 'save',
          name: 'background.md',
          content: revised,
          baseline: digest(original),
        },
      });
      expect(edit.isError).not.toBe(true);
      const deletion = await client.callTool({
        name: 'pitchcrew_update_profile',
        arguments: {
          action: 'delete',
          name: 'background.md',
          baseline: digest(revised),
        },
      });
      expect(deletion.isError).not.toBe(true);
      const result = deletion.structuredContent as unknown as EditResult;
      expect(result.trashId).toEqual(expect.any(String));
      expect(await readProfile(f.directory)).toEqual([]);
      const trash = await f.daemon.service.listProfileTrash();
      expect(trash).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ trashId: result.trashId, name: 'background.md' }),
        ]),
      );
    } finally {
      await client.close();
    }
  }, 30000);

  it('rejects stale edits and stale deletions without losing the saved local version', async () => {
    const f = await setup();
    await f.daemon.service.saveProfile('background.md', original);
    const run = active(f);
    for (const action of ['save', 'delete']) {
      const result = await update(f, run.token, {
        action,
        name: 'background.md',
        baseline: digest('Older fictional content'),
        ...(action === 'save' ? { content: revised } : {}),
      });
      expect(result.response.status).toBe(409);
    }
    expect(await readProfile(f.directory)).toEqual([{ name: 'background.md', content: original }]);
    expect(await f.daemon.service.listProfileTrash()).toEqual([]);
  });

  it.each<[string, Parameters<typeof active>[1]]>([
    ['missing grant', { editProfile: false }],
    ['scheduled run', { run: { routineId: 'fictional-routine' } }],
    ['crew task', { run: { taskId: 'fictional-task' } }],
    ['invocation without a request', { run: { requestId: undefined } }],
    ['external MCP request', { message: { content: '[External MCP agent]\nUpdate the profile.' } }],
    ['peer message', { message: { from: 'tracker' } }],
    [
      'scheduled receipt',
      {
        request: {
          routine: { routineId: 'fictional-routine', scheduledFor: '2026-11-16T00:00:00.000Z' },
        },
      },
    ],
    ['wrong request delivery', { request: { deliveries: [] } }],
  ])('denies %s before exposing sources or changing notes', async (_name, options) => {
    const f = await setup();
    const run = active(f, options);
    const writes = vi.spyOn(f.daemon.service.connectors, 'writeProfileGithub');
    for (const action of ['profile_edit_sources', 'update_profile']) {
      const result = await agent(f, run.token, action, {
        action: 'save',
        name: 'background.md',
        baseline: null,
        content: original,
      });
      expect(result.response.status).toBeGreaterThanOrEqual(400);
    }
    expect(await readProfile(f.directory)).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
  });

  it('rejects edits while another active run is reading the profile', async () => {
    const f = await setup();
    const run = active(f);
    const other: Run = { ...run.run, id: randomUUID(), roleId: 'writer', requestId: undefined };
    f.daemon.service.board.record('run', other, 'writer', 'Fictional concurrent profile reader');
    const result = await update(f, run.token, {
      action: 'save',
      name: 'background.md',
      baseline: null,
      content: original,
    });
    expect(result.response.status).toBeGreaterThanOrEqual(400);
    expect(await readProfile(f.directory)).toEqual([]);
    f.daemon.service.board.record(
      'run',
      { ...other, status: 'completed' },
      'writer',
      'Reader ended',
    );
  });

  it.each(['user', 'external', 'crew', 'routine'] as const)(
    'validates the original request behind a question continuation: %s',
    async (origin) => {
      const f = await setup();
      const run = active(f);
      const board = f.daemon.service.board;
      const rootMessage: ChatMessage = {
        ...run.message,
        id: randomUUID(),
        content:
          origin === 'external'
            ? '[External MCP agent]\nCreate a note.'
            : 'Create my fictional profile note.',
      };
      const rootRequest: ChatRequest = {
        ...run.request,
        id: randomUUID(),
        messageId: rootMessage.id,
        content: rootMessage.content,
        deliveries: [{ roleId: 'documenter', runId: null, status: 'waiting', error: '' }],
      };
      const rootRun: Run = {
        ...run.run,
        id: randomUUID(),
        requestId: rootRequest.id,
        status: 'waiting',
        ...(origin === 'crew' ? { taskId: randomUUID() } : {}),
        ...(origin === 'routine' ? { routineId: randomUUID() } : {}),
      };
      rootRequest.deliveries[0]!.runId = rootRun.id;
      const question: UserInputRequest = {
        id: randomUUID(),
        threadId: run.run.threadId!,
        sourceThreadId: run.run.threadId!,
        roleId: 'documenter',
        runId: rootRun.id,
        messageId: randomUUID(),
        cardId: null,
        createdAt: new Date().toISOString(),
        status: 'answered',
        question: 'Which profile note?',
        reason: '',
        continuationNotes: '',
        options: [],
        multiSelect: false,
        answer: { selected: [], text: 'background.md' },
        answerMessageId: run.message.id,
      };
      board.record('message', rootMessage, 'user', 'Fictional original request');
      board.record('chat_request', rootRequest, 'user', 'Fictional original request receipt');
      board.record('run', rootRun, 'documenter', 'Fictional original question run');
      board.record('user_input', question, 'user', 'Fictional answered question');
      board.record(
        'chat_request',
        { ...run.request, rootRunId: rootRun.id, userInputId: question.id },
        'user',
        'Fictional answer continuation',
      );
      const result = await update(f, run.token, {
        action: 'save',
        name: 'background.md',
        baseline: null,
        content: original,
      });
      expect(result.response.status).toBe(origin === 'user' ? 200 : 400);
      expect(await readProfile(f.directory)).toEqual(
        origin === 'user' ? [{ name: 'background.md', content: original }] : [],
      );
    },
  );

  it('allows legacy direct chat runs only when their saved user message owns the same run', async () => {
    const f = await setup();
    const run = active(f, { run: { requestId: undefined } });
    f.daemon.service.board.record(
      'message',
      {
        ...run.message,
        runId: run.run.id,
      },
      'user',
      'Fictional legacy direct request',
    );
    const result = await update(f, run.token, {
      action: 'save',
      name: 'background.md',
      baseline: null,
      content: original,
    });
    expect(result.response.status).toBe(200);
    expect(await readProfile(f.directory)).toEqual([{ name: 'background.md', content: original }]);
  });

  it('preserves an interrupted approved update instead of allowing direct edits through its recovery gate', async () => {
    const f = await setup();
    const run = active(f);
    const source = profileSource();
    const proposal: ProfileMaintenanceProposal = {
      id: randomUUID(),
      roleId: 'documenter',
      runId: randomUUID(),
      source,
      baseSources: [source],
      baseProfile: [],
      documents: [],
      missing: [],
      status: 'applying',
      selected: [],
      verifiedFacts: true,
      snapshotDigest: digest('Fictional interrupted approved snapshot'),
      createdAt: new Date().toISOString(),
    };
    f.daemon.service.board.record(
      'profile_proposal',
      proposal,
      'user',
      'Fictional interrupted update',
    );
    const result = await update(f, run.token, {
      action: 'save',
      name: 'background.md',
      baseline: null,
      content: original,
    });
    expect(result.response.status).toBe(400);
    expect(result.result).toMatchObject({
      error: expect.stringContaining('Finish the approved profile update'),
    });
    expect(await readProfile(f.directory)).toEqual([]);
    expect(f.daemon.service.board.get('profile_proposal', proposal.id)).toEqual(proposal);
  });

  it('reauthorizes queued edits after permissions change while another write holds the queue', async () => {
    const f = await setup();
    const run = active(f);
    const sources = f.daemon.service.profileSources;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.spyOn(sources, 'list').mockImplementationOnce(async () => {
      entered();
      await gate;
      return [];
    });
    const firstEdit = f.daemon.service.agentCall(run.token, 'update_profile', {
      input: {
        action: 'save',
        name: 'first.md',
        baseline: null,
        content: original,
      },
    });
    await started;
    const secondEdit = f.daemon.service.agentCall(run.token, 'update_profile', {
      input: {
        action: 'save',
        name: 'second.md',
        baseline: null,
        content: revised,
      },
    });
    const settled = Promise.allSettled([firstEdit, secondEdit]);
    const role = f.daemon.service.board.get<Role>('role', 'documenter');
    f.daemon.service.board.record(
      'role',
      {
        ...role,
        capabilities: { ...role.capabilities!, editProfile: false },
      },
      'user',
      'Fictional access revoked while queued',
    );
    release();
    expect((await settled).map((result) => result.status)).toEqual(['rejected', 'rejected']);
    expect(await readProfile(f.directory)).toEqual([]);
  });

  it('rejects traversal, missing baselines and invalid save/delete payloads', async () => {
    const f = await setup();
    const run = active(f);
    const valid = { action: 'save', name: 'background.md', baseline: null, content: original };
    const invalid = [
      { ...valid, name: '../outside.md' },
      { ...valid, name: 'nested/background.md' },
      { action: 'save', name: 'background.md', content: original },
      { ...valid, content: undefined },
      { ...valid, content: 'Null\0byte' },
      { ...valid, extra: 'not allowed' },
      { ...valid, action: 'delete' },
      { action: 'delete', name: 'background.md', baseline: null },
    ];
    for (const input of invalid)
      expect((await update(f, run.token, input)).response.status).toBeGreaterThanOrEqual(400);
    expect(await readProfile(f.directory)).toEqual([]);
  });

  it('synchronizes an imported note by its saved path/revision and advances its manifest only after confirmation', async () => {
    const f = await setup();
    await f.daemon.service.saveProfile('background.md', original);
    const [source] = await attach(f);
    connected(f);
    const write = vi
      .spyOn(f.daemon.service.connectors, 'writeProfileGithub')
      .mockResolvedValue(writeResult);
    const run = active(f);
    const edited = await update(f, run.token, {
      action: 'save',
      name: 'background.md',
      baseline: digest(original),
      content: revised,
    });
    expect(edited.response.status).toBe(200);
    expect(edited.result.sync).toMatchObject({ status: 'synced', branch: 'dev', commit });
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: 'fictional/profile',
        branch: 'dev',
        path: 'notes/background.md',
        content: revised,
        expectedSha: first,
      }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    const current = await f.daemon.service.profileSources.list();
    expect(current[0]?.id).toBe(source!.id);
    expect(current[0]?.files).toEqual([
      expect.objectContaining({
        name: 'background.md',
        path: 'notes/background.md',
        revision: second,
        digest: digest(revised),
        url: writeResult.url,
      }),
    ]);
    write.mockResolvedValueOnce({ ...writeResult, sha: null });
    const deleted = await update(f, run.token, {
      action: 'delete',
      name: 'background.md',
      baseline: digest(revised),
    });
    expect(deleted.result.sync.status).toBe('synced');
    expect(write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: 'notes/background.md',
        content: null,
        expectedSha: second,
      }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect((await f.daemon.service.profileSources.list())[0]?.files).toEqual([]);
    expect(await readProfile(f.directory)).toEqual([]);
  });

  it('keeps existing local-only notes local until an explicit source attachment is requested', async () => {
    const f = await setup();
    await f.daemon.service.saveProfile('local.md', original);
    const [source] = await attach(f, [profileSource({ files: [] })]);
    connected(f);
    const write = vi
      .spyOn(f.daemon.service.connectors, 'writeProfileGithub')
      .mockResolvedValue(writeResult);
    const run = active(f);
    const local = await update(f, run.token, {
      action: 'save',
      name: 'local.md',
      baseline: digest(original),
      content: revised,
    });
    expect(local.result.sync.status).toBe('local_only');
    expect(write).not.toHaveBeenCalled();
    const attached = await update(f, run.token, {
      action: 'save',
      name: 'local.md',
      baseline: digest(revised),
      content: revised,
      sourceId: source!.id,
      path: 'notes/local.md',
    });
    expect(attached.result.sync.status).toBe('synced');
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'notes/local.md',
        expectedSha: null,
        content: revised,
      }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });

  it('adds new notes to a sole import or an explicit source path without granting project watches writes', async () => {
    const f = await setup();
    const [source] = await attach(f, [profileSource({ files: [] })]);
    connected(f);
    const write = vi
      .spyOn(f.daemon.service.connectors, 'writeProfileGithub')
      .mockResolvedValue(writeResult);
    const run = active(f, { github: true });
    expect(
      (
        await update(f, run.token, {
          action: 'save',
          name: 'new.md',
          baseline: null,
          content: original,
        })
      ).result.sync.status,
    ).toBe('synced');
    expect(write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: 'notes/new.md',
        expectedSha: null,
      }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(
      (
        await update(f, run.token, {
          action: 'save',
          name: 'project.md',
          baseline: null,
          content: revised,
          sourceId: source!.id,
          path: 'notes/projects/atlas.md',
        })
      ).result.sync.status,
    ).toBe('synced');
    expect(write).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: 'notes/projects/atlas.md',
        expectedSha: null,
      }),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(
      (await f.daemon.service.profileSources.list())[0]?.files.map((file) => file.path),
    ).toEqual(['notes/new.md', 'notes/projects/atlas.md']);
  });

  it('requires an unambiguous import and prevents duplicate, escaping, instruction and project-watch paths before local writes', async () => {
    const f = await setup();
    const firstSource = profileSource();
    const secondSource = profileSource({
      id: 'b'.repeat(24),
      input: {
        provider: 'github',
        repository: 'fictional/other-profile',
        path: 'other-notes',
      },
      files: [],
    });
    const project = profileSource({
      id: 'c'.repeat(24),
      mode: 'project',
      revision: first,
      files: [],
    });
    await attach(f, [firstSource, secondSource, project]);
    const write = vi.spyOn(f.daemon.service.connectors, 'writeProfileGithub');
    const run = active(f, { github: true });
    const valid = { action: 'save', name: 'new.md', baseline: null, content: original };
    for (const selection of [
      {},
      { sourceId: firstSource.id, path: 'notes/background.md' },
      { sourceId: firstSource.id, path: '../outside.md' },
      { sourceId: firstSource.id, path: 'outside/note.md' },
      { sourceId: firstSource.id, path: 'notes/AGENTS.md' },
      { sourceId: firstSource.id, path: 'notes/.git/config.md' },
      { sourceId: project.id, path: 'notes/new.md' },
    ])
      expect(
        (await update(f, run.token, { ...valid, ...selection })).response.status,
      ).toBeGreaterThanOrEqual(400);
    expect(await readProfile(f.directory)).toEqual([]);
    expect(write).not.toHaveBeenCalled();
    const listed = await agent<{ sources: { id: string }[] }>(f, run.token, 'profile_edit_sources');
    expect(listed.result.sources.map((source) => source.id)).toEqual([
      firstSource.id,
      secondSource.id,
    ]);
  });

  it.each(['disconnected', 'remote_conflict'] as const)(
    'keeps the local edit and old manifest when GitHub sync fails: %s',
    async (failure) => {
      const f = await setup();
      await f.daemon.service.saveProfile('background.md', original);
      const sources = await attach(f);
      if (failure !== 'disconnected') connected(f);
      const write = vi
        .spyOn(f.daemon.service.connectors, 'writeProfileGithub')
        .mockRejectedValue(
          new Error('The GitHub profile note changed. Refresh the source before editing it.'),
        );
      const run = active(f);
      const result = await update(f, run.token, {
        action: 'save',
        name: 'background.md',
        baseline: digest(original),
        content: revised,
      });
      expect(result.response.status).toBe(200);
      expect(result.result).toMatchObject({ ok: true, sync: { status: 'unsynced' } });
      expect(result.result.sync.error).toEqual(expect.any(String));
      expect(await readProfile(f.directory)).toEqual([{ name: 'background.md', content: revised }]);
      expect(await f.daemon.service.profileSources.list()).toEqual(sources);
      expect(write).toHaveBeenCalledTimes(failure === 'remote_conflict' ? 1 : 0);
    },
  );

  it.each(['cancelled', 'permission_revoked'] as const)(
    'rechecks authorization before the remote commit: %s',
    async (failure) => {
      const f = await setup();
      await f.daemon.service.saveProfile('background.md', original);
      const sources = await attach(f);
      connected(f);
      const run = active(f, { github: true });
      let committed = false;
      const write = vi
        .spyOn(f.daemon.service.connectors, 'writeProfileGithub')
        .mockImplementation(async (_input, _signal, authorize) => {
          expect(authorize).toEqual(expect.any(Function));
          if (failure === 'cancelled') run.controller.abort();
          else {
            const role = f.daemon.service.board.get<Role>('role', 'documenter');
            f.daemon.service.board.record(
              'role',
              {
                ...role,
                capabilities: { ...role.capabilities!, editProfile: false },
              },
              'user',
              'Fictional profile edit permission revoked',
            );
          }
          await authorize!();
          committed = true;
          return writeResult;
        });
      const result = await update(f, run.token, {
        action: 'save',
        name: 'background.md',
        baseline: digest(original),
        content: revised,
      });
      expect(result.result.sync.status).toBe('unsynced');
      expect(write).toHaveBeenCalledOnce();
      expect(committed).toBe(false);
      expect(await readProfile(f.directory)).toEqual([{ name: 'background.md', content: revised }]);
      expect(await f.daemon.service.profileSources.list()).toEqual(sources);
    },
  );
});
