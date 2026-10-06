import type { RuntimeAdapter } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { readCodexModels } from '../src/codex/models.ts';
import { readCopilotModels } from '../src/copilot-cli/models.ts';
import {
  discoverModels,
  modelListCommand,
  parseCursorModels,
  parseGrokModels,
  parseKiroModels,
  parseOmpModels,
  parseOpenCodeModels,
  parsePiModels,
  normalizeModels,
} from '../src/model-discovery.ts';
import { withChat } from '../src/process.ts';

const fixture = fileURLToPath(new URL('./fixtures/models-cli.mjs', import.meta.url));
const suggestions = [{ value: 'suggested', label: 'Suggested' }];
const adapter = (listModels?: RuntimeAdapter['listModels']): RuntimeAdapter =>
  withChat({
    id: 'opencode',
    models: suggestions,
    listModels,
    detect: async () => ({ id: 'opencode', available: true, version: 'fixture', detail: '' }),
    launch: async () => '',
  });
afterEach(() => vi.unstubAllEnvs());

it('reads native model lists with ANSI removal and without connector OAuth configuration', async () => {
  vi.stubEnv('PITCHCREW_GOOGLE_CLIENT_SECRET', 'fixture-secret');
  const text = await modelListCommand(process.execPath, [fixture, 'cursor']);
  expect(parseCursorModels(text)).toEqual([
    { value: 'auto', label: 'Auto' },
    { value: 'fixture-high', label: 'Fixture High' },
  ]);
});

it('keeps OpenCode provider-qualified IDs intact and removes duplicates', () => {
  expect(parseOpenCodeModels('provider/model-v1:0\nother/model\nprovider/model-v1:0\n')).toEqual([
    { value: 'provider/model-v1:0', label: 'provider · model-v1:0' },
    { value: 'other/model', label: 'other · model' },
  ]);
  expect(() => parseOpenCodeModels('Please sign in')).toThrow();
});

it('reads Pi provider/model tables and preserves a successful empty account catalog', () => {
  expect(
    parsePiModels(
      'provider  model  context  max-out  thinking  images\nexample  fixture-1  200K  32K  yes  no\n',
    ),
  ).toEqual([
    {
      value: 'example/fixture-1',
      label: 'example · fixture-1',
      reasoning: { levels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] },
    },
  ]);
  expect(parsePiModels('No models available. Set API keys in environment variables.')).toEqual([]);
  expect(() =>
    parsePiModels('provider model context max-out thinking images\nInvalid row'),
  ).toThrow();
});

it('retains only supported native reasoning variants and effort metadata', () => {
  const metadata = {
    name: 'Fixture',
    variants: { low: {}, high: {}, unknown: {} },
    secret: 'fixture-secret',
  };
  expect(
    parseOpenCodeModels(`example/model\n${JSON.stringify(metadata, null, 2)}\nexample/plain\n`),
  ).toEqual([
    { value: 'example/model', label: 'example · Fixture', reasoning: { levels: ['low', 'high'] } },
    { value: 'example/plain', label: 'example · plain' },
  ]);
  expect(
    parseOmpModels(
      JSON.stringify({
        models: [
          {
            selector: 'example/model',
            name: 'Fixture',
            reasoning: true,
            thinking: ['low', 'high'],
          },
        ],
      }),
    ),
  ).toEqual([
    { value: 'example/model', label: 'example · Fixture', reasoning: { levels: ['low', 'high'] } },
  ]);
  expect(
    parsePiModels('provider model context max-out thinking images\nexample plain 200K 32K no no'),
  ).toEqual([{ value: 'example/plain', label: 'example · plain' }]);
  expect(
    normalizeModels([
      {
        value: 'fixture',
        label: 'Fixture',
        reasoning: { levels: ['high', 'high'], default: 'high' },
      },
    ]),
  ).toEqual([
    { value: 'fixture', label: 'Fixture', reasoning: { levels: ['high'], default: 'high' } },
  ]);
});

it('projects only OMP chat selectors and names from JSON metadata', () => {
  expect(
    parseOmpModels(
      JSON.stringify({
        models: [
          {
            provider: 'example',
            id: 'fixture',
            selector: 'example/fixture',
            name: 'Fixture',
            kind: 'chat',
            headers: { authorization: 'fixture-secret' },
          },
        ],
      }),
    ),
  ).toEqual([{ value: 'example/fixture', label: 'example · Fixture' }]);
  expect(parseOmpModels('{"models":[]}')).toEqual([]);
  expect(() =>
    parseOmpModels('{"models":[{"selector":"example/image","name":"Image","kind":"image"}]}'),
  ).toThrow();
});

it('reads Kiro model IDs and Grok lists without exposing account metadata', () => {
  expect(
    parseKiroModels(
      '{"models":[{"model_id":"auto","model_name":"Auto","description":"Fixture"}],"default_model":"auto"}',
    ),
  ).toEqual([{ value: 'auto', label: 'Auto' }]);
  expect(
    parseGrokModels(
      'You are logged in with fixture.invalid.\n\nDefault model: fixture-one\n\nAvailable models:\n  * fixture-one (default)\n  - fixture-two\n',
    ),
  ).toEqual([
    { value: 'fixture-one', label: 'fixture-one' },
    { value: 'fixture-two', label: 'fixture-two' },
  ]);
  expect(() => parseKiroModels('{"models":[{}]}')).toThrow();
  expect(() => parseGrokModels('Authentication required')).toThrow();
});

it('uses runtime models in place of suggestions, including an empty successful list', async () => {
  const listModels = vi.fn(async () => [{ value: 'live', label: 'Live' }]);
  expect(await discoverModels(adapter(listModels), true)).toMatchObject({
    modelSource: 'runtime',
    models: [{ value: 'live', label: 'Live' }],
  });
  expect(listModels).toHaveBeenCalledOnce();
  expect(
    await discoverModels(
      adapter(async () => []),
      true,
    ),
  ).toMatchObject({ modelSource: 'runtime', models: [] });
});

it('labels fallbacks for unsupported, missing, failed and malformed runtimes without leaking diagnostics', async () => {
  const listModels = vi.fn(async () => {
    throw new Error('fixture-private-diagnostic');
  });
  for (const candidate of [
    adapter(),
    adapter(listModels),
    adapter(async () => [{ value: 'bad selector', label: 'Invalid' }]),
  ]) {
    const catalog = await discoverModels(candidate, true);
    expect(catalog).toMatchObject({ models: suggestions, modelSource: 'fallback' });
    expect(JSON.stringify(catalog)).not.toContain('fixture-private-diagnostic');
  }
  listModels.mockClear();
  expect(await discoverModels(adapter(listModels), false)).toMatchObject({
    modelSource: 'fallback',
    models: suggestions,
  });
  expect(listModels).not.toHaveBeenCalled();
});

it('bounds native subprocess output and supports cancellation', async () => {
  await expect(modelListCommand(process.execPath, [fixture, 'oversized'])).rejects.toThrow();
  await expect(
    modelListCommand(process.execPath, [fixture, 'hang'], AbortSignal.timeout(100)),
  ).rejects.toThrow();
  await expect(modelListCommand(process.execPath, [fixture, 'fail'])).rejects.toThrow();
});

it('lists paginated Codex models without creating a session, filters hidden models and strips metadata', async () => {
  expect(await readCodexModels(process.execPath, [fixture, 'codex'])).toEqual([
    {
      value: 'fixture-one',
      label: 'Fixture One',
      reasoning: { levels: ['low', 'high'], default: 'high' },
    },
    { value: 'fixture-two', label: 'Fixture Two' },
  ]);
});

it.each(['codex-invalid', 'codex-error', 'codex-loop', 'codex-exit'])(
  'rejects %s rather than publishing an invalid Codex catalog',
  async (mode) => {
    await expect(readCodexModels(process.execPath, [fixture, mode])).rejects.toThrow();
  },
);

it('stops Codex model discovery on timeout and cancellation', async () => {
  await expect(
    readCodexModels(process.execPath, [fixture, 'codex-hang'], undefined, 100),
  ).rejects.toThrow('timed out');
  await expect(
    readCodexModels(process.execPath, [fixture, 'codex-hang'], AbortSignal.timeout(100)),
  ).rejects.toThrow('cancelled');
});

it.each(['copilot', 'copilot-legacy'])(
  'lists models through %s framed RPC without a session, excluding disabled policy entries',
  async (mode) => {
    expect(await readCopilotModels(process.execPath, [fixture, mode])).toEqual([
      {
        value: 'fixture-live',
        label: 'Fixture · Live',
        reasoning: { levels: ['low', 'high'], default: 'low' },
      },
    ]);
  },
);

it('stops Copilot discovery on malformed catalogs, timeout and cancellation', async () => {
  await expect(readCopilotModels(process.execPath, [fixture, 'copilot-invalid'])).rejects.toThrow();
  await expect(
    readCopilotModels(process.execPath, [fixture, 'copilot-hang'], undefined, 100),
  ).rejects.toThrow('timed out');
  await expect(
    readCopilotModels(process.execPath, [fixture, 'copilot-hang'], AbortSignal.timeout(100)),
  ).rejects.toThrow('cancelled');
});
