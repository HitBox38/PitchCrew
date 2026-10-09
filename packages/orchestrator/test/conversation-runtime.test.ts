import { afterEach, expect, it, vi } from 'vitest';
import { adapters } from '@pitchcrew/adapters';
import type { ChatContext, Conversation, Role, RuntimeModel } from '@pitchcrew/core';
import { cleanup, setup, waitForSnapshot } from './helpers/daemon.ts';

afterEach(cleanup);
it('inherits current agent settings independently and restores inheritance after explicit overrides', async () => {
  const turns: ChatContext[] = [];
  const models: RuntimeModel[] = ['fixture-first', 'fixture-second', 'fixture-override'].map(
    (value) => ({
      value,
      label: value,
      reasoning: { levels: ['low', 'medium', 'high'] },
    }),
  );
  for (const id of ['codex', 'claude-code'] as const) {
    vi.spyOn(adapters[id], 'detect').mockResolvedValue({
      id,
      available: true,
      version: 'fixture',
      detail: '',
    });
    vi.spyOn(adapters[id], 'listModels').mockResolvedValue(models);
    vi.spyOn(adapters[id], 'chat').mockImplementation(async (context) => {
      turns.push(context);
      return { reply: 'Fictional runtime reply.' };
    });
  }
  const { daemon, request } = await setup(19671);
  const original = daemon.service.board.get<Role>('role', 'scout');
  const defaults: Role = {
    ...original,
    runtime: 'codex',
    model: 'fixture-first',
    reasoning: 'high',
  };
  expect((await request('/roles/scout', 'PUT', defaults)).response.status).toBe(200);
  const patch = async (configuration: Conversation['configurations'][string]) => {
    const updated = await request<Conversation>('/conversations/scout', 'PUT', {
      configurations: { scout: configuration },
    });
    expect(updated.response.status).toBe(200);
    expect(updated.result.configurations.scout).toEqual(configuration);
  };
  const send = async (expected: Partial<Role>) => {
    const count = turns.length + 1;
    expect(
      (await request('/conversations/scout/messages', 'POST', { content: 'Fictional question.' }))
        .response.status,
    ).toBe(202);
    await vi.waitFor(() => expect(turns).toHaveLength(count));
    await waitForSnapshot(request, (snapshot) =>
      snapshot.runs.every((run) => run.status === 'completed'),
    );
    expect(turns.at(-1)?.role).toMatchObject(expected);
  };
  await patch({ model: 'fixture-override', reasoning: null });
  await send({ runtime: 'codex', model: 'fixture-override', reasoning: null });
  const changed: Role = {
    ...defaults,
    runtime: 'claude-code',
    model: 'fixture-second',
    reasoning: 'medium',
  };
  expect((await request('/roles/scout', 'PUT', changed)).response.status).toBe(200);
  await send({ runtime: 'claude-code', model: 'fixture-override', reasoning: null });
  await patch({ reasoning: 'low' });
  await send({ runtime: 'claude-code', model: 'fixture-second', reasoning: 'low' });
  await patch({ model: 'fixture-override' });
  await send({ runtime: 'claude-code', model: 'fixture-override', reasoning: 'medium' });
  await patch({ runtime: 'codex' });
  await send({ runtime: 'codex', model: 'fixture-second', reasoning: 'medium' });
  await patch({});
  await send({ runtime: 'claude-code', model: 'fixture-second', reasoning: 'medium' });
  daemon.service.board.rebuild();
  expect(
    daemon.service.board.get<Conversation>('conversation', 'scout').configurations.scout,
  ).toEqual({});
  const invalid = await request('/conversations/scout', 'PUT', {
    configurations: { scout: { model: 'unsupported' } },
  });
  expect(invalid.response.status).toBe(400);
  const unavailable = daemon.service.runtimes.find((runtime) => runtime.id === 'claude-code')!;
  unavailable.available = false;
  await patch({});
});
