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
  const { daemon, request } = await setup(false, { dev: false });
  const { result: snapshot } = await request<Snapshot>('/snapshot');
  expect(snapshot.runtimes.some((runtime) => runtime.id === 'demo')).toBe(false);
  expect(snapshot.demoAvailable).toBe(false);
  expect(snapshot.roles.every((role) => role.runtime !== 'demo' && !role.enabled)).toBe(true);
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
  const { daemon, directory, port } = await setup();
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
  const production = await createDaemon({ directory, port, seedSkills: false });
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

it('loads an example job conversation in every chat state without starting work', async () => {
  const chat = vi.spyOn(adapters.demo, 'chat');
  const { daemon } = await setup();
  await daemon.service.loadExamples();
  await new Promise((resolve) => setTimeout(resolve, 50));
  const snapshot = await daemon.service.snapshot();
  const thread = snapshot.conversations?.find((item) => item.title.endsWith('packet review'));
  expect(thread?.participants).toEqual(['writer', 'reviewer']);
  const requests = (snapshot.chatRequests ?? []).filter((item) => item.threadId === thread?.id);
  expect(requests.map((item) => item.deliveries[0]?.status)).toEqual([
    'queued',
    'paused',
    'failed',
  ]);
  expect(
    snapshot.userInputs?.filter(
      (item) => item.threadId === thread?.id && item.status === 'pending',
    ),
  ).toHaveLength(1);
  const runs = snapshot.runs
    .filter((run) => run.threadId === thread?.id)
    .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt));
  expect(runs.map((run) => run.status)).toEqual(['completed', 'completed', 'waiting']);
  expect(runs[0]?.activity?.some((step) => step.status === 'failed')).toBe(true);
  expect(
    snapshot.tasks.filter((task) => task.threadId === thread?.id).map((task) => task.status),
  ).toEqual(['completed', 'failed', 'cancelled']);
  const proposal = snapshot.proposals.find((item) => item.runId === runs[0]?.id);
  expect(proposal).toMatchObject({ roleId: 'writer', status: 'pending' });
  expect(proposal?.changes.instructions).toContain('packet rules');
  expect(proposal?.changes.capabilities?.readApplications).toBe(true);
  const skills = snapshot.skillProposals.filter((item) => item.threadId === thread?.id);
  expect(skills).toHaveLength(1);
  expect(skills[0]).toMatchObject({ roleId: 'reviewer', status: 'pending', skillId: null });
  expect(skills[0]?.skill.roleIds).toEqual(['writer', 'reviewer']);
  expect(chat).not.toHaveBeenCalled();
});
