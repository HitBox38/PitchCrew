import {
  defaultRoleIds,
  type RuntimeId,
  type RuntimeInfo,
  type RuntimeModel,
} from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { adapters, recommendRuntime, suggestedModels } from '../src/index.ts';

function runtime(id: RuntimeId, models: RuntimeModel[] = [], available = true): RuntimeInfo {
  return {
    id,
    available,
    version: 'fixture',
    detail: '',
    models,
    modelSource: 'runtime',
    modelDetail: '',
  };
}
const sol: RuntimeModel = {
  value: 'gpt-6.1-sol',
  label: 'Sol',
  reasoning: { levels: ['low', 'medium', 'high'] },
};
const astra: RuntimeModel = { ...sol, value: 'gpt-6-astra', label: 'Astra' };
const luna: RuntimeModel = { ...sol, value: 'gpt-6-luna', label: 'Luna' };
const sonnet: RuntimeModel = { ...sol, value: 'sonnet', label: 'Sonnet' };

describe('role runtime recommendations', () => {
  it('selects role-specific models and supported reasoning without changing the catalogs', () => {
    const runtimes = [runtime('codex', [sol, astra, luna]), runtime('claude-code', [sonnet])];
    const before = structuredClone(runtimes);
    expect(defaultRoleIds.map((id) => recommendRuntime(id, runtimes))).toMatchObject([
      { runtime: 'codex', model: sol.value, reasoning: 'medium' },
      { runtime: 'claude-code', model: 'sonnet', reasoning: 'high' },
      { runtime: 'codex', model: astra.value, reasoning: 'high' },
      { runtime: 'codex', model: sol.value, reasoning: 'medium' },
      { runtime: 'codex', model: luna.value, reasoning: 'high' },
      { runtime: 'codex', model: sol.value, reasoning: 'medium' },
      { runtime: 'codex', model: astra.value, reasoning: 'high' },
    ]);
    expect(runtimes).toEqual(before);
  });

  it('uses the preferred model through another installed runtime before a weaker model', () => {
    expect(
      recommendRuntime('reviewer', [
        runtime('codex', [sol]),
        runtime('opencode', [{ ...astra, value: `openai/${astra.value}` }]),
      ]),
    ).toMatchObject({ runtime: 'opencode', model: `openai/${astra.value}`, reasoning: 'high' });
    expect(
      recommendRuntime('reviewer', [
        runtime('codex', [astra], false),
        runtime('claude-code', [sonnet]),
      ]),
    ).toMatchObject({ runtime: 'claude-code', model: 'sonnet', available: true });
  });

  it('prefers native catalogs to unverified suggestions and respects a successful empty catalog', () => {
    const fallback: RuntimeInfo = { ...runtime('codex'), ...suggestedModels(adapters.codex) };
    expect(
      recommendRuntime('reviewer', [fallback, runtime('claude-code', [sonnet])]),
    ).toMatchObject({ runtime: 'claude-code', model: 'sonnet', modelSource: 'runtime' });
    expect(recommendRuntime('scout', [runtime('codex')])).toMatchObject({
      runtime: 'codex',
      model: '',
      reasoning: null,
    });
  });

  it('never invents unsupported reasoning or selects an unknown first model', () => {
    expect(
      recommendRuntime('scout', [
        runtime('codex', [{ ...sol, reasoning: { levels: ['low', 'high'] } }]),
      ]).reasoning,
    ).toBeNull();
    expect(
      recommendRuntime('scout', [runtime('codex', [{ value: 'unknown', label: 'GPT-6.1 Sol' }])]),
    ).toMatchObject({ model: '', reasoning: null });
    expect(() => recommendRuntime('constructor', [runtime('codex', [sol])])).toThrow('built-in');
  });

  it('keeps the preferred setup visible when no supported runtime is installed', () => {
    const runtimes = Object.values(adapters).map((adapter) => ({
      ...runtime(adapter.id, [], false),
      ...suggestedModels(adapter),
    }));
    expect(recommendRuntime('writer', runtimes)).toMatchObject({
      runtime: 'claude-code',
      model: 'sonnet',
      reasoning: 'high',
      available: false,
    });
    expect(recommendRuntime('reviewer', runtimes)).toMatchObject({
      runtime: 'codex',
      model: astra.value,
      available: false,
    });
  });

  it.each([
    ['codex', 'gpt-6-astra'],
    ['claude-code', 'opus'],
    ['opencode', 'openai/gpt-6-astra'],
    ['copilot-cli', 'claude-opus-5.5'],
    ['cursor-agent', 'claude-opus-5-5-high'],
    ['gemini-cli', 'pro'],
    ['kiro-cli', 'claude-opus-4.6'],
    ['pi', 'anthropic/claude-opus-5-5'],
    ['oh-my-pi', 'openai/gpt-6-astra'],
    ['hermes', 'openrouter:anthropic/claude-opus-5-5'],
    ['goose', 'anthropic/claude-opus-5-5'],
    ['grok', 'grok-4.7'],
  ] as const)('considers %s when it is the installed alternative', (id, value) => {
    expect(
      recommendRuntime('reviewer', [runtime(id, [{ value, label: 'Fixture' }])]),
    ).toMatchObject({ runtime: id, model: value, reasoning: null, available: true });
  });

  it('preserves the matching Cursor reasoning preset and qualified selectors exactly', () => {
    expect(
      recommendRuntime('writer', [
        runtime('cursor-agent', [
          { value: 'claude-sonnet-5-5-medium', label: 'Medium' },
          { value: 'claude-sonnet-5-5-high', label: 'High' },
        ]),
      ]),
    ).toMatchObject({ model: 'claude-sonnet-5-5-high', reasoning: null });
  });
});
