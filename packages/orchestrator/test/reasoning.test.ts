import { adapters } from '@pitchcrew/adapters';
import {
  currentEventVersion,
  decodeEvent,
  type ChatContext,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
async function reasoningSetup(port: number) {
  vi.spyOn(adapters['claude-code'], 'detect').mockResolvedValue({
    id: 'claude-code',
    available: true,
    version: 'fixture',
    detail: '',
  });
  const turns: ChatContext[] = [];
  vi.spyOn(adapters['claude-code'], 'chat').mockImplementation(async (context) => {
    turns.push(context);
    return { reply: 'Fixture reply' };
  });
  const fixture = await setup(port);
  const role = fixture.daemon.service.board.get<Role>('role', 'scout');
  return {
    ...fixture,
    turns,
    role: { ...role, runtime: 'claude-code' as const, model: 'sonnet', reasoning: 'high' as const },
  };
}

it('saves defaults, applies chat overrides and CLI default, and replays exact effective run settings', async () => {
  const { daemon, request, role, turns } = await reasoningSetup(14951);
  expect((await request<Role>('/roles/scout', 'PUT', role)).response.status).toBe(200);
  for (const [override, expected] of [
    [undefined, 'high'],
    ['low', 'low'],
    [null, null],
  ] as const) {
    const { result: run, response } = await request<Run>('/roles/scout/chat', 'POST', {
      content: 'Fixture question',
      ...(override !== undefined ? { reasoning: override } : {}),
    });
    expect(response.status).toBe(202);
    expect(run.configuration?.role.reasoning).toBe(expected);
    await finish(request, run.id);
    expect(turns.at(-1)?.role.reasoning).toBe(expected);
    expect(daemon.service.board.get<Role>('role', role.id).reasoning).toBe('high');
  }
  const before = daemon.service.board.list<Run>('run');
  daemon.service.board.rebuild();
  expect(daemon.service.board.list<Run>('run')).toEqual(before);
  expect(daemon.service.board.get<Role>('role', role.id).reasoning).toBe('high');
  expect(daemon.service.board.events().at(-1)?.version).toBe(currentEventVersion);
  expect(
    decodeEvent(
      JSON.stringify({ version: 12, kind: 'role', data: { ...role, reasoning: undefined } }),
    ).data,
  ).not.toHaveProperty('reasoning');
});

it('creates agents with reasoning and rejects unsupported models and levels before recording work', async () => {
  const { daemon, request, role } = await reasoningSetup(14952);
  const created = await request<Role>('/roles', 'POST', {
    ...role,
    id: 'research-helper',
    workflow: 'chat',
    reasoning: 'medium',
  });
  expect(created.response.status).toBe(201);
  expect(created.result.reasoning).toBe('medium');
  for (const invalid of [
    { model: 'haiku', reasoning: 'high' },
    { model: '', reasoning: 'high' },
    { model: 'sonnet', reasoning: 'off' },
    { model: 'sonnet', reasoning: 'invented' },
  ]) {
    expect((await request('/roles/scout', 'PUT', { ...role, ...invalid })).response.status).toBe(
      400,
    );
  }
  expect(
    (await request('/roles/scout/chat', 'POST', { content: 'Fixture', reasoning: 'high' })).response
      .status,
  ).toBe(400);
  expect(daemon.service.board.list('run')).toHaveLength(0);
  expect(daemon.service.board.list('message')).toHaveLength(0);
  expect((await request<Role>('/roles/scout', 'PUT', role)).response.status).toBe(200);
});

it('keeps defaults for omitted settings and follow-ups and clears them when switching models', async () => {
  const { daemon, request, role, turns } = await reasoningSetup(14953);
  await request('/roles/scout', 'PUT', role);
  const { reasoning: _reasoning, ...legacyInput } = role;
  expect((await request<Role>('/roles/scout', 'PUT', legacyInput)).result.reasoning).toBe('high');
  let completeRoot!: () => void;
  vi.mocked(adapters['claude-code'].chat).mockImplementationOnce(async (context) => {
    turns.push(context);
    await new Promise<void>((resolve) => {
      completeRoot = resolve;
    });
    return { reply: 'Fixture root' };
  });
  const { result: root } = await request<Run>('/roles/scout/chat', 'POST', {
    content: 'Fixture question',
    reasoning: 'low',
  });
  await vi.waitFor(() => expect(turns).toHaveLength(1));
  const token = [...daemon.service.capabilities.keys()][0];
  await daemon.service.agentCall(token, 'invoke', {
    roleId: 'scout',
    content: 'Follow up',
    mode: 'chat',
  });
  completeRoot();
  await waitForSnapshot(
    request,
    (snapshot) =>
      snapshot.runs.length === 2 && snapshot.runs.every((run) => run.status === 'completed'),
  );
  expect(turns.map((turn) => turn.role.reasoning)).toEqual(['low', 'high']);
  expect(daemon.service.board.get<Run>('run', root.id).configuration?.role.reasoning).toBe('low');
  const routine = daemon.service.saveRoutine({
    name: 'Fixture routine',
    roleId: 'scout',
    content: 'Fixture routine',
    startAt: '2030-01-01T09:00:00Z',
    timezone: 'UTC',
    enabled: true,
  });
  await daemon.service.tickRoutines(new Date('2030-01-01T09:00:00Z'));
  await finish(
    request,
    daemon.service.routines().find((item) => item.id === routine.id)!.lastRunId!,
  );
  expect(turns.at(-1)?.role.reasoning).toBe('high');
  expect(
    (await request<Role>('/roles/scout', 'PUT', { ...legacyInput, model: 'haiku' })).result
      .reasoning,
  ).toBeNull();
});
