import { adapters } from '@pitchcrew/adapters';
import { roleCreate, type ChatContext, type Role, type Run, type Snapshot } from '@pitchcrew/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, finish, setup } from './helpers/daemon.ts';

afterEach(cleanup);

it('makes every support default usable through the generic creation and chat flow', async () => {
  const turns: ChatContext[] = [];
  vi.spyOn(adapters.demo, 'chat').mockImplementation(async (context) => {
    turns.push(context);
    return { reply: 'Fictional setup verified. No external action taken.' };
  });
  const { daemon, directory, request } = await setup(14580);
  const initial = (await request<Snapshot>('/snapshot')).result;
  expect(initial.roles).toHaveLength(7);
  expect(initial.routines).toEqual([]);
  expect(initial.runs).toEqual([]);
  for (const id of ['submitter', 'tracker', 'documenter', 'pipeline-coach']) {
    const role = initial.roles.find((role) => role.id === id)!;
    const instructions = await readFile(join(directory, 'roles', id, 'AGENTS.md'), 'utf8');
    expect(instructions).toContain(role.instructions);
    const input = roleCreate.parse({ ...role, id: `fixture-${id}` });
    const created = await request<Role>('/roles', 'POST', input);
    expect(created.response.status).toBe(201);
    expect(created.result).toMatchObject(input);
    for (const target of [role, created.result]) {
      const { result: run } = await request<Run>(`/roles/${target.id}/chat`, 'POST', {
        content: 'Explain your setup requirements.',
        threadId: target.id,
      });
      await finish(request, run.id);
      expect(turns.at(-1)?.role).toEqual(target);
      expect(daemon.service.board.get<Run>('run', run.id).configuration?.role).toEqual(target);
    }
  }
  expect(turns).toHaveLength(8);
  expect(daemon.service.board.list('routine')).toEqual([]);
  expect(daemon.service.board.list('computer_approval')).toEqual([]);
});
