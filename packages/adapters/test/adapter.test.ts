import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { runCli, parseResult, requireCliVersion } from '../src/process.ts';
import { cardInput, type RunContext } from '@pitchcrew/core';
const context: RunContext = {
  card: {
    ...cardInput.parse({ company: 'Example', title: 'Engineer' }),
    id: 'fixture',
    state: 'lead',
    fit: null,
    owner: null,
    packet: null,
    feedback: [],
    createdAt: '',
    updatedAt: '',
    sample: true,
  },
  role: {
    id: 'scout',
    name: 'Scout',
    description: 'Fixture',
    runtime: 'demo',
    model: '',
    enabled: true,
    instructions: 'Fixture',
  },
  profile: [],
  directory: process.cwd(),
  mcp: { command: '', args: [], env: {} },
  signal: new AbortController().signal,
  onMessage: () => {},
};
it('normalizes a headless JSONL subprocess without using a provider account', async () => {
  const result = await runCli(
    process.execPath,
    [fileURLToPath(new URL('./fixtures/fake-cli.mjs', import.meta.url))],
    context,
    'test',
    (event) => (typeof event.result === 'string' ? event.result : null),
  );
  expect(result).toEqual({ role: 'scout', fit: 87, reasons: ['Fixture result'] });
});
it('rejects a role-mismatched structured response', () => {
  expect(() => parseResult('{"role":"reviewer","passed":true,"feedback":[]}', context)).toThrow(
    'wrong role',
  );
});
it('requires a recognizable runtime version with the scoped-tool capabilities', () => {
  const health = { id: 'pi' as const, available: true, version: 'pi v1.0.0', detail: 'Installed.' };
  expect(requireCliVersion(health, [1, 0, 0], 'pi')).toBe(health);
  expect(requireCliVersion({ ...health, version: '0.99.0' }, [1, 0, 0], 'pi').available).toBe(
    false,
  );
  expect(requireCliVersion({ ...health, version: 'unrecognized' }, [1, 0, 0], 'pi').available).toBe(
    false,
  );
  expect(requireCliVersion({ ...health, version: '18.4.8' }, [18, 4, 9], 'omp').available).toBe(
    false,
  );
  expect(requireCliVersion({ ...health, version: '18.5.0' }, [18, 4, 9], 'omp').available).toBe(
    true,
  );
  expect(
    requireCliVersion({ ...health, version: 'grok 1.0.44' }, [1, 0, 45], 'grok').available,
  ).toBe(false);
  const missing = { ...health, available: false };
  expect(requireCliVersion(missing, [1, 0, 0], 'pi')).toBe(missing);
});
