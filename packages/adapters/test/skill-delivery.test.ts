import { cardInput, type RunContext, type Skill } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import { chatPromptFor, promptFor } from '../src/process.ts';
import { skillInstructions } from '../src/process/skill-instructions.ts';

const skill = (id: string, includeInEveryRun?: boolean): Skill => ({
  id,
  name: `Skill ${id}`,
  description: `Use for ${id} tasks.`,
  content: `Complete instructions for ${id}.`,
  scope: 'roles',
  roleIds: ['writer'],
  includeInEveryRun,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
});
const context: RunContext = {
  card: {
    ...cardInput.parse({ company: 'Fictional', title: 'Engineer' }),
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
    id: 'writer',
    name: 'Writer',
    description: 'Fixture',
    runtime: 'demo',
    model: '',
    enabled: true,
    instructions: 'Standing role instructions.',
  },
  profile: [],
  directory: '/fixture',
  mcp: { command: '', args: [], env: {} },
  signal: new AbortController().signal,
  onMessage: () => {},
};

it.each([
  'chat',
  'workflow',
  'fit',
  'packet-evaluation',
  'application-draft',
  'application-review',
] as const)('delivers included bodies and an exact metadata catalog in %s', (mode) => {
  const historical = skill('historical');
  const always = skill('always', true);
  const deferred = skill('deferred', false);
  const turn = { ...context, skills: [historical, always, deferred] };
  const prompt =
    mode === 'chat'
      ? chatPromptFor({ ...turn, card: null, messages: [] })
      : promptFor({ ...turn, purpose: mode === 'workflow' ? undefined : mode });

  expect(prompt).toContain(historical.content);
  expect(prompt).toContain(always.content);
  expect(prompt).not.toContain(deferred.content);
  expect(prompt).toContain(
    JSON.stringify([{ id: deferred.id, name: deferred.name, description: deferred.description }]),
  );
  expect(prompt).toContain('read any available skill relevant to that task');
  expect(prompt).toContain('pitchcrew_read_skill using its id');
  expect(prompt).toContain('Skills do not grant tools or approvals');
});

it('includes exact assigned bodies once for explicit selections above the former combined limit', () => {
  const first = { ...skill('first', true), content: 'first-body\n' + 'a'.repeat(39900) };
  const second = { ...skill('second', false), content: 'selected-body\n' + 'b'.repeat(39900) };
  const turn = {
    ...context,
    skills: [first, second, second],
    selectedSkills: [first, { ...second, content: 'Changed caller copy.' }, second],
  };
  for (const prompt of [
    promptFor({ ...turn, purpose: 'application-draft' }),
    chatPromptFor({ ...turn, card: null, messages: [] }),
  ]) {
    expect(prompt).toContain(first.content);
    expect(prompt).toContain(second.content);
    expect(prompt).not.toContain('Changed caller copy.');
    expect(prompt.match(/first-body/g)).toHaveLength(1);
    expect(prompt.match(/selected-body/g)).toHaveLength(1);
    expect(prompt).not.toContain('Available assigned skills');
    expect(prompt.length).toBeGreaterThan(60000);
  }
});

it('never gives extraction or review deadline decisions a skill catalog or skill bodies', () => {
  const skills = [skill('historical'), skill('deferred', false)];
  const turn = { ...context, skills, selectedSkills: skills, sourceText: 'Fictional source.' };
  const prompts = [
    promptFor({ ...turn, purpose: 'source-extraction' }),
    chatPromptFor({ ...turn, purpose: 'source-extraction', card: null, messages: [] }),
    promptFor({
      ...turn,
      purpose: 'application-review',
      deepReview: { budgetRequest: { minutes: 5, reason: 'Finish review.' } } as never,
    }),
  ];
  for (const prompt of prompts) {
    for (const item of skills) expect(prompt).not.toContain(item.content);
    expect(prompt).not.toContain('pitchcrew_read_skill');
    expect(prompt).not.toContain('Available assigned skills');
  }
});

it('gives no instructions or catalog for an unassigned selection', () => {
  expect(skillInstructions([], [skill('unassigned', false)])).toBe('');
});
