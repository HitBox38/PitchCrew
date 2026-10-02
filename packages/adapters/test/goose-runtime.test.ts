import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '../src/index.ts';
import { runCliText } from '../src/process.ts';
import { cleanup, contextFor, requestFor } from './helpers/runtime.ts';

afterEach(cleanup);
describe('Goose completion and provider selection', () => {
  it('preserves template-like untrusted text literally in the prompt', async () => {
    const context = await contextFor('goose');
    context.card.description = 'Fictional job: {{ 7 * 7 }} {% include "marker.txt" %}';
    await adapters.goose.run(context);
    expect((await requestFor(context)).prompt).toContain('{{ 7 * 7 }} {% include');
  });
  it.each([
    'claude-code',
    'gemini-cli',
    'codex',
    'claude-acp',
    'codex-acp',
    'custom-cli',
    undefined,
  ])('rejects unsupported provider %s before starting a process', async (provider) => {
    const context = await contextFor('goose');
    vi.stubEnv('GOOSE_PROVIDER', provider);
    await expect(adapters.goose.run(context)).rejects.toThrow('Choose a Goose provider/model');
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects a CLI provider in the model setting even with an API environment default', async () => {
    const context = await contextFor('goose');
    context.role.model = 'claude-code/fixture-model';
    await expect(adapters.goose.run(context)).rejects.toThrow('Choose a Goose provider/model');
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('accepts provider/model while preserving model names that contain slashes', async () => {
    const context = await contextFor('goose');
    context.role.model = 'openrouter/example/fixture-model';
    await adapters.goose.run(context);
    const request = await requestFor(context);
    expect(request.args.slice(-4)).toEqual([
      '--provider',
      'openrouter',
      '--model',
      'example/fixture-model',
    ]);
  });
  it.each(['terminal-error', 'missing-terminal'])(
    'rejects %s after assistant output',
    async (mode) => {
      await expect(adapters.goose.run(await contextFor('goose', mode))).rejects.toThrow(
        'valid structured result',
      );
    },
  );
});

vi.mock('../src/process.ts', () =>
  import('./helpers/runtime-mocks.ts').then((m) => m.processMock()),
);
vi.mock('../src/acp.ts', () => import('./helpers/runtime-mocks.ts').then((m) => m.acpMock()));
