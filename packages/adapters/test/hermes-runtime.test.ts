import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapters } from '../src/index.ts';
import { detectCli, runCliText } from '../src/process.ts';
import { cleanup, contextFor, requestFor } from './helpers/runtime.ts';

afterEach(cleanup);
describe('Hermes scoped one-shot turns', () => {
  it.each([
    ['Hermes Agent v0.21.4', false],
    ['Hermes Agent v0.21.5 (2026.9.24)', true],
    ['unrecognized', false],
  ])('requires a supported version: %s', async (version, available) => {
    vi.mocked(detectCli).mockResolvedValueOnce({
      id: 'hermes',
      available: true,
      version,
      detail: 'Installed.',
    });
    expect(await adapters.hermes.detect()).toMatchObject({ available });
  });
  it('preserves provider-qualified model names containing slashes and untrusted prompt text', async () => {
    const context = await contextFor('hermes');
    context.role.model = 'openrouter:example/fixture-model';
    context.card.description = 'Fictional job: $(touch marker) `command` {{ 7 * 7 }}';
    await adapters.hermes.run(context);
    const request = await requestFor(context);
    expect(request.args.slice(-4)).toEqual([
      '--provider',
      'openrouter',
      '--model',
      'example/fixture-model',
    ]);
    expect(request.prompt).toContain(context.card.description);
  });
  it('uses an allowed native environment provider when the model is empty', async () => {
    vi.stubEnv('HERMES_INFERENCE_PROVIDER', 'anthropic');
    const context = await contextFor('hermes');
    await adapters.hermes.run(context);
    const request = await requestFor(context);
    expect(request.args.slice(-2)).toEqual(['--provider', 'anthropic']);
    expect(request.args).not.toContain('--model');
  });
  it.each([
    'copilot-acp:fixture-model',
    'auto:fixture-model',
    'moa:preset',
    'openrouter:',
    'openrouter:moa:preset',
  ])('rejects unsupported selector %s before launching', async (model) => {
    const context = await contextFor('hermes');
    context.role.model = model;
    await expect(adapters.hermes.run(context)).rejects.toThrow('Choose a Hermes provider:model');
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('rejects ambient agent CLI providers', async () => {
    vi.stubEnv('HERMES_INFERENCE_PROVIDER', 'copilot-acp');
    await expect(adapters.hermes.run(await contextFor('hermes'))).rejects.toThrow(
      'Choose a Hermes provider:model',
    );
    expect(runCliText).not.toHaveBeenCalled();
  });
  it('clears ambient configuration, prompt, plugin and approval overrides', async () => {
    for (const key of [
      'HERMES_CONFIG_PATH',
      'HERMES_ENV_PATH',
      'HERMES_EPHEMERAL_SYSTEM_PROMPT',
      'HERMES_YOLO_MODE',
      'HERMES_IGNORE_USER_CONFIG',
      'HERMES_SAFE_MODE',
    ])
      vi.stubEnv(key, 'fictional-ambient-override');
    vi.stubEnv('HERMES_ENABLE_PROJECT_PLUGINS', '1');
    const context = await contextFor('hermes');
    await adapters.hermes.run(context);
    const { environment } = await requestFor(context);
    for (const key of [
      'HERMES_CONFIG_PATH',
      'HERMES_ENV_PATH',
      'HERMES_EPHEMERAL_SYSTEM_PROMPT',
      'HERMES_YOLO_MODE',
      'HERMES_IGNORE_USER_CONFIG',
      'HERMES_SAFE_MODE',
    ])
      expect(environment[key]).toBeUndefined();
    expect(environment.HERMES_ENABLE_PROJECT_PLUGINS).toBe('0');
  });
  it.each(['terminal-error', 'missing-terminal', 'late-error', 'empty-terminal'])(
    'rejects %s after valid assistant text',
    async (mode) => {
      await expect(adapters.hermes.run(await contextFor('hermes', mode))).rejects.toThrow(
        'valid structured result',
      );
      await expect(
        adapters.hermes.chat({ ...(await contextFor('hermes', mode)), card: null, messages: [] }),
      ).rejects.toThrow();
    },
  );
});

vi.mock('../src/process.ts', () =>
  import('./helpers/runtime-mocks.ts').then((m) => m.processMock()),
);
