import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import {
  runCli,
  parseResult,
  requireCliVersion,
  chatCli,
  promptFor,
  chatPromptFor,
} from '../src/process.ts';
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

it('normalizes a chat subprocess without a card or a provider account', async () => {
  const result = await chatCli(
    process.execPath,
    [fileURLToPath(new URL('./fixtures/fake-cli.mjs', import.meta.url)), '--chat'],
    { ...context, card: null, messages: [], request: 'Say hello.' },
    (event) => (typeof event.result === 'string' ? event.result : null),
  );
  expect(result).toEqual({ reply: 'Fixture conversational response.' });
});

it('does not pass connector OAuth configuration to provider subprocesses', async () => {
  vi.stubEnv('PITCHCREW_GOOGLE_CLIENT_SECRET', 'fixture-secret');
  try {
    const result = await runCli(
      process.execPath,
      [fileURLToPath(new URL('./fixtures/fake-cli.mjs', import.meta.url)), '--check-env'],
      context,
      'test',
      (event) => (typeof event.result === 'string' ? event.result : null),
    );
    expect(result).toMatchObject({ reasons: ['absent'] });
  } finally {
    vi.unstubAllEnvs();
  }
});

it('includes managed skills in both workflow and chat prompts without granting capabilities', () => {
  const skills = [
    {
      id: 'fixture-skill',
      name: 'Evidence checklist',
      description: 'Use when reviewing claims.',
      content: 'Compare every claim with an exact source quotation.',
      scope: 'all' as const,
      roleIds: [],
      createdAt: '',
      updatedAt: '',
      deletedAt: null,
    },
  ];
  const workflow = promptFor({ ...context, skills });
  const chat = chatPromptFor({ ...context, skills, card: null, messages: [] });
  for (const prompt of [workflow, chat]) {
    expect(prompt).toContain(context.role.instructions);
    expect(prompt).toContain(skills[0].name);
    expect(prompt).toContain(skills[0].description);
    expect(prompt).toContain(skills[0].content);
    expect(prompt).toContain('do not grant tools');
    expect(prompt).toContain('Never send externally');
    expect(prompt).toContain('pitchcrew_propose_skill');
    expect(prompt).toContain('skills.sh');
  }
  expect(promptFor(context)).not.toContain('Assigned skills');
});
