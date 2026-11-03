import { expect, it } from 'vitest';
import type { Skill } from '@pitchcrew/core';
import { baseSkills } from '@pitchcrew/core/base-skills';
import { initialSkillDraft } from '../components/SkillEditor/helpers.ts';
import {
  groupedStarterErrors,
  latestSuccessfulCheck,
  skillMatches,
  toggleAssignment,
} from '../helpers.ts';

it('shows each starter skill failure reason once with every affected skill', () => {
  const limit = 'GitHub’s public request limit was reached. Try importing again later.';
  expect(
    groupedStarterErrors([
      { name: 'cover-letter', error: limit },
      { name: 'view-pdf', error: 'Not found.' },
      { name: 'humanizer', error: limit },
    ]),
  ).toEqual([
    { error: limit, names: ['cover-letter', 'humanizer'] },
    { error: 'Not found.', names: ['view-pdf'] },
  ]);
});

const skill = (patch: Partial<Skill>) =>
  ({
    id: 's1',
    name: 'Evidence checklist',
    description: 'Check claims',
    content: 'Quote the profile.',
    scope: 'roles',
    roleIds: ['writer'],
    ...patch,
  }) as Skill;

it('filters the library by agent, shared scope, pending updates and search text', () => {
  const base = {
    filter: 'all',
    query: '',
    updatesOnly: false,
    pending: new Set<string>(),
    creator: 'You',
  } as const;
  const writer = skill({});
  const shared = skill({ id: 's2', scope: 'all', roleIds: [] });
  expect(skillMatches(writer, { ...base, filter: 'writer' })).toBe(true);
  expect(skillMatches(writer, { ...base, filter: 'reviewer' })).toBe(false);
  expect(skillMatches(shared, { ...base, filter: 'reviewer' })).toBe(true);
  expect(skillMatches(writer, { ...base, filter: 'shared' })).toBe(false);
  expect(skillMatches(writer, { ...base, updatesOnly: true })).toBe(false);
  expect(skillMatches(writer, { ...base, updatesOnly: true, pending: new Set(['s1']) })).toBe(true);
  expect(skillMatches(writer, { ...base, query: '  QUOTE ' })).toBe(true);
  expect(skillMatches(writer, { ...base, query: 'missing' })).toBe(false);
});

it('toggles assignment chips between all agents and an explicit set', () => {
  expect(toggleAssignment({ scope: 'all', roleIds: [] }, 'writer')).toEqual({
    scope: 'roles',
    roleIds: ['writer'],
  });
  expect(toggleAssignment({ scope: 'roles', roleIds: ['writer'] }, 'scout')).toEqual({
    scope: 'roles',
    roleIds: ['writer', 'scout'],
  });
  expect(toggleAssignment({ scope: 'roles', roleIds: ['writer'] }, 'writer').roleIds).toEqual([]);
  expect(toggleAssignment({ scope: 'roles', roleIds: ['writer'] }, 'all').scope).toBe('all');
});

it('reports the latest successful update check', () => {
  expect(
    latestSuccessfulCheck([
      { successfulAt: '2026-10-01T00:00:00.000Z' },
      { successfulAt: null },
      { successfulAt: '2026-10-03T00:00:00.000Z' },
    ]),
  ).toBe('2026-10-03T00:00:00.000Z');
  expect(latestSuccessfulCheck([])).toBeUndefined();
});

it('preserves saved delivery and defaults manual skills, imports and starter restoration deliberately', () => {
  const initial = { skill: null, starter: null, initialRole: null, importing: false };
  expect(initialSkillDraft(initial).includeInEveryRun).toBe(true);
  expect(initialSkillDraft({ ...initial, importing: true }).includeInEveryRun).toBe(false);
  expect(initialSkillDraft({ ...initial, skill: skill({}) }).includeInEveryRun).toBe(true);
  expect(
    initialSkillDraft({ ...initial, skill: skill({ includeInEveryRun: false }) }).includeInEveryRun,
  ).toBe(false);
  for (const name of ['prompt-injection-guard', 'cover-letter']) {
    const starter = baseSkills.find((entry) => entry.name === name)!;
    expect(initialSkillDraft({ ...initial, importing: true, starter }).includeInEveryRun).toBe(
      name === 'prompt-injection-guard',
    );
  }
  const starter = baseSkills.find((entry) => entry.name === 'career-application-tailoring')!;
  expect(initialSkillDraft({ ...initial, starter }).includeInEveryRun).toBe(false);
});
