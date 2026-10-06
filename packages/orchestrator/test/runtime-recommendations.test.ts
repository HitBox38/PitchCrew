import { adapters } from '@pitchcrew/adapters';
import {
  defaultRoleIds,
  type Role,
  type RuntimeId,
  type RuntimeRecommendation,
  type Snapshot,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);
function installed(ids: RuntimeId[]) {
  for (const adapter of Object.values(adapters)) {
    vi.spyOn(adapter, 'detect').mockImplementation(async () => ({
      id: adapter.id,
      available: ids.includes(adapter.id),
      version: 'fixture',
      detail: '',
    }));
    if (adapter.listModels) vi.spyOn(adapter, 'listModels').mockResolvedValue(adapter.models);
  }
}

it('detects all runtimes and seeds paused production roles from native models and reasoning', async () => {
  installed(['codex', 'claude-code', 'opencode']);
  const { daemon, directory, request } = await setup(14961, false, { dev: false });
  const { result } = await request<Snapshot>('/snapshot');
  expect(
    result.roles.map(({ id, runtime, model, reasoning, enabled }) => ({
      id,
      runtime,
      model,
      reasoning,
      enabled,
    })),
  ).toEqual([
    { id: 'scout', runtime: 'codex', model: 'gpt-6.1-sol', reasoning: 'medium', enabled: false },
    { id: 'writer', runtime: 'claude-code', model: 'sonnet', reasoning: 'high', enabled: false },
    { id: 'reviewer', runtime: 'codex', model: 'gpt-6-astra', reasoning: 'high', enabled: false },
    {
      id: 'submitter',
      runtime: 'codex',
      model: 'gpt-6.1-sol',
      reasoning: 'medium',
      enabled: false,
    },
    { id: 'tracker', runtime: 'codex', model: 'gpt-6-luna', reasoning: 'high', enabled: false },
    {
      id: 'documenter',
      runtime: 'codex',
      model: 'gpt-6.1-sol',
      reasoning: 'medium',
      enabled: false,
    },
    {
      id: 'pipeline-coach',
      runtime: 'codex',
      model: 'gpt-6-astra',
      reasoning: 'high',
      enabled: false,
    },
  ]);
  for (const adapter of Object.values(adapters).filter((adapter) => adapter.id !== 'demo'))
    expect(adapter.detect).toHaveBeenCalled();
  expect(adapters['claude-code'].listModels).toHaveBeenCalledOnce();
  expect(adapters.codex.listModels).toHaveBeenCalledOnce();
  expect(result.runs).toEqual([]);
  expect(result.routines).toEqual([]);
  const { readFile } = await import('node:fs/promises');
  expect(await readFile(`${directory}/roles/scout/AGENTS.md`, 'utf8')).toContain(
    result.roles[0].instructions,
  );
  daemon.service.board.rebuild();
  expect(daemon.service.board.list<Role>('role')).toEqual(result.roles);
});

it('rechecks machine availability on every recommendation and leaves saved roles unchanged until settings are saved', async () => {
  installed(['codex', 'claude-code']);
  const { daemon, request } = await setup(14962, false, { dev: false });
  const saved = daemon.service.board.get<Role>('role', 'reviewer');
  const before = daemon.service.board.events();
  vi.mocked(adapters.codex.detect).mockResolvedValue({
    id: 'codex',
    available: false,
    version: '',
    detail: 'Removed fixture',
  });
  const recommendation = await request<RuntimeRecommendation>(
    '/roles/reviewer/runtime-recommendation',
    'POST',
  );
  expect(recommendation.response.status).toBe(200);
  expect(recommendation.result).toMatchObject({
    runtime: 'claude-code',
    model: 'opus',
    reasoning: 'high',
    available: true,
  });
  expect(daemon.service.board.events()).toEqual(before);
  expect(daemon.service.board.get<Role>('role', 'reviewer')).toEqual(saved);
  const updated = await request<Role>('/roles/reviewer', 'PUT', {
    ...saved,
    runtime: recommendation.result.runtime,
    model: recommendation.result.model,
    reasoning: recommendation.result.reasoning,
  });
  expect(updated.response.status).toBe(200);
  expect(updated.result).toMatchObject({
    runtime: 'claude-code',
    model: 'opus',
    reasoning: 'high',
    enabled: false,
  });
  const checks = vi.mocked(adapters.codex.detect).mock.calls.length;
  await request('/roles/reviewer/runtime-recommendation', 'POST');
  expect(vi.mocked(adapters.codex.detect).mock.calls.length).toBeGreaterThan(checks);
});

it('backfills only missing roles on restart without changing custom or retired defaults', async () => {
  installed(['codex', 'claude-code']);
  const { daemon } = await setup(14963, false, { dev: false });
  const role = daemon.service.board.get<Role>('role', 'scout');
  const customized = {
    ...role,
    name: 'My scout',
    runtime: 'claude-code' as const,
    model: 'haiku',
    reasoning: null,
    retiredAt: '2026-10-06T00:00:00Z',
  };
  daemon.service.board.record('role', customized, 'user', 'Fictional retired default');
  const before = daemon.service.board.list<Role>('role');
  await daemon.service.initialize(false);
  expect(daemon.service.board.list<Role>('role')).toEqual(before);
  await expect(daemon.service.runtimeRecommendation('scout')).rejects.toThrow('retired');
});

it('keeps preferred setups paused when no runtime is installed and preserves deterministic Demo defaults', async () => {
  installed([]);
  const production = await setup(14964, false, { dev: false });
  expect(production.daemon.service.board.list<Role>('role')).toHaveLength(defaultRoleIds.length);
  expect(production.daemon.service.board.get<Role>('role', 'scout')).toMatchObject({
    runtime: 'codex',
    model: 'gpt-6.1-sol',
    reasoning: 'medium',
    enabled: false,
  });
  const development = await setup(14965);
  expect(
    development.daemon.service.board
      .list<Role>('role')
      .every(
        (role) =>
          role.runtime === 'demo' && role.model === '' && role.reasoning == null && role.enabled,
      ),
  ).toBe(true);
});

it('restricts recommendations to user sessions and rejects custom roles', async () => {
  installed([]);
  const { daemon, request } = await setup(14966);
  const response = await fetch(`${daemon.url}/api/roles/scout/runtime-recommendation`, {
    method: 'POST',
    headers: { 'x-pitchcrew-client': 'ui', authorization: 'Bearer fictional-agent-token' },
  });
  expect(response.status).toBe(403);
  expect((await request('/roles/missing/runtime-recommendation', 'POST')).response.status).toBe(
    400,
  );
  const template = daemon.service.board.get<Role>('role', 'scout');
  daemon.service.board.record(
    'role',
    { ...template, id: 'custom-helper' },
    'user',
    'Fixture custom role',
  );
  expect(
    (await request('/roles/custom-helper/runtime-recommendation', 'POST')).response.status,
  ).toBe(400);
});
