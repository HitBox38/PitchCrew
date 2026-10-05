import type { InstructionUpdate, Snapshot } from '@pitchcrew/core';
import { expect, it } from 'vitest';
import {
  instructionUpdateExplanation,
  instructionUpdateFor,
  joinNames,
  pendingInstructionUpdates,
} from '../instruction-updates.ts';

const update = {
  roleId: 'writer',
  state: 'customized',
  revision: 'c'.repeat(16),
  instructions: 'Fictional default.',
  changes: [],
  toolDifferences: [],
  dismissed: false,
} as InstructionUpdate;

it('keeps only unanswered updates for editable roles', () => {
  const data = {
    roles: [
      { id: 'writer', name: 'Writer' },
      { id: 'scout', name: 'Scout' },
      { id: 'reviewer', name: 'Reviewer', retiredAt: '2026-10-05T00:00:00Z' },
    ],
    instructionUpdates: [
      update,
      { ...update, roleId: 'scout', dismissed: true },
      { ...update, roleId: 'reviewer' },
      { ...update, roleId: 'missing' },
    ],
  } as unknown as Snapshot;
  expect(pendingInstructionUpdates(data).map((item) => item.roleId)).toEqual(['writer']);
  expect(instructionUpdateFor(data, 'scout')?.dismissed).toBe(true);
  expect(pendingInstructionUpdates({ roles: [] } as unknown as Snapshot)).toEqual([]);
});

it('explains each update state in plain words', () => {
  expect(instructionUpdateExplanation({ ...update, state: 'unedited' })).toContain('replaces');
  expect(instructionUpdateExplanation(update)).toContain('You edited an earlier default');
  expect(instructionUpdateExplanation({ ...update, state: 'unknown_base' })).toContain(
    'count as your own',
  );
  for (const state of ['unedited', 'customized', 'unknown_base'] as const)
    expect(instructionUpdateExplanation({ ...update, state })).not.toContain('—');
});

it('joins role names', () => {
  expect(joinNames([])).toBe('');
  expect(joinNames(['Scout'])).toBe('Scout');
  expect(joinNames(['Scout', 'Writer'])).toBe('Scout and Writer');
  expect(joinNames(['Scout', 'Writer', 'Tracker'])).toBe('Scout, Writer and Tracker');
});
