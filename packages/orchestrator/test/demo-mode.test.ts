import { adapters } from '@pitchcrew/adapters';
import type { Role, Snapshot } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createDaemon } from '../src/server.ts';
import { cleanup, resources, setup } from './helpers/daemon.ts';

afterEach(cleanup);

it('excludes Demo and rejects its entry points outside development mode', async () => {
  const detect = vi.spyOn(adapters.demo, 'detect');
  const chat = vi.spyOn(adapters.demo, 'chat');
  const run = vi.spyOn(adapters.demo, 'run');
  const { daemon, request } = await setup(14571, false, false);
  const { result: snapshot } = await request<Snapshot>('/snapshot');
  expect(snapshot.runtimes.some((runtime) => runtime.id === 'demo')).toBe(false);
  expect(snapshot.demoAvailable).toBe(false);
  expect(snapshot.roles.every((role) => role.runtime === 'claude-code' && !role.enabled)).toBe(
    true,
  );
  expect(detect).not.toHaveBeenCalled();
  for (const refresh of [false, true])
    expect((await request('/runtimes/demo/models', 'POST', { refresh })).response.status).toBe(400);
  expect((await request('/examples', 'POST')).response.status).toBe(400);
  expect(
    (await request('/roles/scout', 'PUT', { ...snapshot.roles[0], runtime: 'demo' })).response
      .status,
  ).toBe(400);
  await expect(
    daemon.service.createRole({
      id: 'fixture',
      name: 'Fixture',
      description: 'Fictional role.',
      instructions: '',
      runtime: 'demo',
      model: '',
      enabled: true,
    }),
  ).rejects.toThrow('development mode');
  expect((await daemon.service.snapshot()).profile).toEqual([]);
  expect(daemon.service.board.list('card')).toEqual([]);
  expect(chat).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});

it('retains existing Demo role history but blocks chat and workflow runs in production', async () => {
  const { daemon, directory } = await setup(14572);
  expect((await daemon.service.snapshot()).runtimes.some((runtime) => runtime.id === 'demo')).toBe(
    true,
  );
  await daemon.service.loadExamples();
  const roles = daemon.service.board.list<Role>('role');
  const snapshot = await daemon.service.snapshot();
  await daemon.close();
  resources.splice(
    resources.findIndex((resource) => resource.daemon === daemon),
    1,
  );
  const production = await createDaemon({ directory, port: 14572, seedSkills: false });
  resources.push({ daemon: production, directory });
  expect(production.service.board.list<Role>('role')).toEqual(roles);
  expect((await production.service.snapshot()).demoAvailable).toBe(false);
  await expect(
    production.service.sendChat('scout', { content: 'Fixture question' }),
  ).rejects.toThrow('runtime');
  await expect(production.service.startRun(snapshot.cards[0].id, 'scout')).rejects.toThrow(
    'runtime',
  );
  await expect(production.service.runtimeModels('demo', true)).rejects.toThrow('development mode');
  await expect(production.service.loadExamples()).rejects.toThrow('development mode');
});
