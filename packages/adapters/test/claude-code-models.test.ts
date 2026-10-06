import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { claudeCode } from '../src/claude-code/index.ts';
import { claudeModelArgs, parseClaudeModels, readClaudeModels } from '../src/claude-code/models.ts';
import { discoverModels } from '../src/model-discovery.ts';

const fixture = fileURLToPath(new URL('./fixtures/claude-models-cli.mjs', import.meta.url));
const read = (mode: string, signal?: AbortSignal, timeout?: number) =>
  readClaudeModels(process.execPath, [fixture, mode, ...claudeModelArgs], signal, timeout);
afterEach(() => vi.unstubAllEnvs());

it.each(['catalog', 'control'])(
  'reads the Claude %s through isolated initialization without user messages or inference',
  async (mode) => {
    vi.stubEnv('PITCHCREW_GOOGLE_CLIENT_SECRET', 'fixture-secret');
    const catalog = await discoverModels({ ...claudeCode, listModels: () => read(mode) }, true);
    expect(catalog).toMatchObject({
      modelSource: 'runtime',
      models: [
        { value: 'default', label: 'Default (recommended)' },
        { value: 'fixture-model', label: 'Fixture · Model' },
      ],
    });
    expect(JSON.stringify(catalog)).not.toContain('fixture-private');
  },
);

it('keeps a successful empty Claude catalog empty instead of adding suggestions', async () => {
  expect(
    await discoverModels({ ...claudeCode, listModels: () => read('empty') }, true),
  ).toMatchObject({
    modelSource: 'runtime',
    models: [],
  });
});

it.each(['invalid', 'missing', 'error', 'exit'])(
  'uses labeled suggestions for a Claude %s response without exposing diagnostics',
  async (mode) => {
    const catalog = await discoverModels({ ...claudeCode, listModels: () => read(mode) }, true);
    expect(catalog).toMatchObject({ modelSource: 'fallback', models: claudeCode.models });
    expect(JSON.stringify(catalog)).not.toContain('fixture-private');
  },
);

it.each(['oversized', 'stderr'])('bounds Claude %s output', async (mode) => {
  await expect(read(mode)).rejects.toThrow('output exceeded');
});

it('stops Claude discovery on timeout, cancellation and a CLI ignoring termination', async () => {
  await expect(read('hang', undefined, 300)).rejects.toThrow('timed out');
  await expect(read('hang', AbortSignal.timeout(300))).rejects.toThrow('cancelled');
  await expect(read('stubborn', undefined, 300)).rejects.toThrow('timed out');
});

it('rejects an already cancelled request and a missing CLI', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Cancelled before start.'));
  await expect(read('catalog', controller.signal)).rejects.toThrow('Cancelled before start.');
  await expect(readClaudeModels(fixture + '-missing', [])).rejects.toThrow('Could not start');
});

it.each([
  null,
  { models: null },
  { models: [null] },
  { models: [{ value: 'bad selector', displayName: 'Invalid' }] },
  { models: [{ value: 'fixture', displayName: '' }] },
  { models: Array.from({ length: 5001 }, () => ({ value: 'fixture', displayName: 'Fixture' })) },
])('rejects invalid Claude catalog data %#', (catalog) => {
  expect(() => parseClaudeModels(catalog)).toThrow();
});
