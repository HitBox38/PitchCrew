import type { RuntimeInfo } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { resolveRuntime } from '../runtimes.ts';

const codex: RuntimeInfo = {
  id: 'codex',
  available: true,
  version: 'Fixture',
  detail: 'Installed fixture runtime',
  models: [{ value: 'fixture-model', label: 'Fixture model' }],
  modelSource: 'runtime',
  modelDetail: 'Fixture catalog',
};

describe('stored role runtime resolution', () => {
  it('keeps a retained Demo role unavailable when production omits its runtime', () => {
    const runtime = resolveRuntime([codex], 'demo');
    expect(runtime).toMatchObject({
      id: 'demo',
      available: false,
      models: [],
      modelSource: 'none',
    });
    expect(runtime.modelDetail).toContain('Choose a real runtime');
  });

  it('preserves a listed runtime and its catalog, including development Demo', () => {
    expect(resolveRuntime([codex], 'codex')).toBe(codex);
    const demo: RuntimeInfo = { ...codex, id: 'demo', models: [], modelSource: 'none' };
    expect(resolveRuntime([demo], 'demo')).toBe(demo);
  });

  it('handles another absent runtime without claiming it is installed', () => {
    expect(resolveRuntime([], 'claude-code')).toMatchObject({
      id: 'claude-code',
      available: false,
      models: [],
    });
  });
});
