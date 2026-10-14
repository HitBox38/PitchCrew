import { adapters } from '@pitchcrew/adapters';
import type { RuntimeId, RuntimeInfo, RuntimeModelCatalog, Snapshot } from '@pitchcrew/core';
import { mkdir, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';
import { cleanup as cleanupContexts, contextFor } from '../../adapters/test/helpers/runtime.ts';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: vi.fn(actual.homedir) };
});
const commands: Record<Exclude<RuntimeId, 'demo'>, string> = {
  'claude-code': 'claude',
  codex: 'codex',
  'gemini-cli': 'gemini',
  opencode: 'opencode',
  'copilot-cli': 'copilot',
  'cursor-agent': 'cursor-agent',
  goose: 'goose',
  'kiro-cli': 'kiro-cli',
  grok: 'grok',
  pi: 'pi',
  'oh-my-pi': 'omp',
  hermes: 'hermes',
};
const fixture = fileURLToPath(
  new URL('../../adapters/test/fixtures/installed-runtime.ts', import.meta.url),
);
const loader = fileURLToPath(import.meta.resolve('tsx'));
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
async function install(bin: string, command: string) {
  await mkdir(bin, { recursive: true });
  await writeFile(
    join(bin, command),
    `#!/bin/sh\nexec ${quote(process.execPath)} --import ${quote(loader)} ${quote(fixture)} ${quote(command)} "$@"\n`,
    { mode: 0o700 },
  );
}
afterEach(async () => {
  await cleanup();
  await cleanupContexts();
});

it.skipIf(process.platform === 'win32')(
  'rechecks, loads models and launches all production CLIs installed after daemon startup',
  async () => {
    const home = (await contextFor('grok')).directory;
    vi.mocked(os.homedir).mockReturnValue(home);
    vi.stubEnv('PATH', join(home, 'empty-bin'));
    vi.stubEnv('GOOSE_PROVIDER', 'openai');
    const { request } = await setup(14968, false, { dev: false });
    const before = (await request<Snapshot>('/snapshot')).result;
    expect(before.runtimes.every((runtime) => !runtime.available)).toBe(true);
    for (const command of Object.values(commands)) await install(join(home, '.local/bin'), command);
    const checked = await request<RuntimeInfo[]>('/runtimes/detect', 'POST');
    expect(checked.response.status).toBe(200);
    expect(checked.result).toHaveLength(Object.keys(commands).length);
    expect(checked.result.every((runtime) => runtime.available)).toBe(true);
    const updated = (await request<Snapshot>('/snapshot')).result;
    expect(updated.runtimes.every((runtime) => runtime.available)).toBe(true);
    expect(updated.roles).toEqual(before.roles);
    expect(updated.events).toEqual(before.events);
    for (const id of Object.keys(commands) as Exclude<RuntimeId, 'demo'>[]) {
      const catalog = await request<RuntimeModelCatalog>(`/runtimes/${id}/models`, 'POST', {
        refresh: true,
      });
      expect(catalog.response.status, id).toBe(200);
      expect(catalog.result.modelSource, id).toBe(adapters[id].listModels ? 'runtime' : 'fallback');
      const context = await contextFor('grok');
      context.role.runtime = id;
      expect(await adapters[id].chat({ ...context, card: null, messages: [] }), id).toEqual({
        reply: 'Fixture conversational café response.',
      });
    }
  },
  30000,
);

it.skipIf(process.platform === 'win32')(
  'finds a new OpenCode native installation outside the inherited PATH',
  async () => {
    const home = (await contextFor('grok')).directory;
    vi.mocked(os.homedir).mockReturnValue(home);
    vi.stubEnv('PATH', join(home, 'empty-bin'));
    expect((await adapters.opencode.detect()).available).toBe(false);
    await install(join(home, '.opencode/bin'), 'opencode');
    expect((await adapters.opencode.detect()).available).toBe(true);
    expect(await adapters.opencode.listModels!(new AbortController().signal)).toEqual([
      { value: 'example/fixture-model', label: 'example · fixture-model' },
    ]);
    const context = await contextFor('grok');
    context.role.runtime = 'opencode';
    expect(await adapters.opencode.chat({ ...context, card: null, messages: [] })).toEqual({
      reply: 'Fixture conversational café response.',
    });
  },
);
