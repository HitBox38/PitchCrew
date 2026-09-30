import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { runCli, parseResult } from '../src/process.ts';
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
