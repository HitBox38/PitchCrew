import type { RuntimeId, Snapshot } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

type Preferences = { revision: string; preferences: Record<string, unknown> };

it('sends adapter traits with the runtime list', async () => {
  const { request } = await setup();
  const { result } = await request<Snapshot>('/snapshot');
  const runtime = (id: RuntimeId) => result.runtimes.find((entry) => entry.id === id);
  for (const id of ['demo', 'codex', 'claude-code', 'opencode'] as const)
    expect(runtime(id)?.applicationIsolation).toBe(true);
  expect(runtime('gemini-cli')?.applicationIsolation).toBe(false);
  expect(runtime('codex')?.customReasoning).toBe(true);
  expect(runtime('pi')?.customReasoning).toBe(true);
  expect(runtime('demo')?.customReasoning).toBe(false);
  expect(runtime('goose')?.customReasoning).toBe(false);
});

it('accepts custom reasoning metadata only for adapters that declare it', async () => {
  const { request } = await setup();
  const save = async (id: RuntimeId) => {
    const { result } = await request<Preferences>(`/runtimes/${id}/model-preferences`);
    return request<{ error?: string }>(`/runtimes/${id}/model-preferences`, 'PUT', {
      preferences: {
        ...result.preferences,
        custom: [{ value: 'fixture', label: 'Fixture', reasoning: { levels: ['high'] } }],
      },
      revision: result.revision,
    });
  };
  const rejected = await save('goose');
  expect([400, 500]).toContain(rejected.response.status);
  expect(rejected.result.error).toContain('does not support custom reasoning controls');
  expect((await save('pi')).response.status).toBe(200);
});
