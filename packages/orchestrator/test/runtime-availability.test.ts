import { adapters } from '@pitchcrew/adapters';
import type { RuntimeInfo, Snapshot } from '@pitchcrew/core';
import { mkdir, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, setup } from './helpers/daemon.ts';
import { cleanup as cleanupContexts, contextFor } from '../../adapters/test/helpers/runtime.ts';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: vi.fn(actual.homedir) };
});

const fixture = fileURLToPath(
  new URL('../../adapters/test/fixtures/installed-grok.ts', import.meta.url),
);
const loader = fileURLToPath(import.meta.resolve('tsx'));
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
afterEach(async () => {
  await cleanup();
  await cleanupContexts();
});

it.skipIf(process.platform === 'win32').each(['.local/bin', '.grok/bin'])(
  'detects Grok installed in %s after startup, then loads models and launches it',
  async (folder) => {
    const context = await contextFor('grok');
    vi.mocked(os.homedir).mockReturnValue(context.directory);
    vi.stubEnv('PATH', dirname(process.execPath));
    for (const adapter of Object.values(adapters).filter((adapter) => adapter.id !== 'grok')) {
      vi.spyOn(adapter, 'detect').mockResolvedValue({
        id: adapter.id,
        available: false,
        version: '',
        detail: '',
      });
    }
    const { request } = await setup(14967, false, { dev: false });
    const before = (await request<Snapshot>('/snapshot')).result;
    expect(before.runtimes.find((runtime) => runtime.id === 'grok')?.available).toBe(false);
    const bin = join(context.directory, folder);
    await mkdir(bin, { recursive: true });
    await writeFile(
      join(bin, 'grok'),
      `#!/bin/sh\nexec ${quote(process.execPath)} --import ${quote(loader)} ${quote(fixture)} "$@"\n`,
      { mode: 0o700 },
    );
    const checked = await request<RuntimeInfo[]>('/runtimes/detect', 'POST');
    expect(checked.response.status).toBe(200);
    expect(checked.result.find((runtime) => runtime.id === 'grok')).toMatchObject({
      available: true,
      version: 'grok 1.0.52 (fixture)',
    });
    const updated = (await request<Snapshot>('/snapshot')).result;
    expect(updated.runtimes.find((runtime) => runtime.id === 'grok')?.available).toBe(true);
    expect(updated.roles).toEqual(before.roles);
    expect(updated.events).toEqual(before.events);
    expect(await adapters.grok.listModels!(new AbortController().signal)).toEqual([
      { value: 'grok-build', label: 'grok-build' },
    ]);
    expect(await adapters.grok.chat({ ...context, card: null, messages: [] })).toEqual({
      reply: 'Fixture Grok reply.',
    });
  },
);
