import type { Role, RoleProposal, SkillProposal } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { capabilityDefaults } from '../../agent-capabilities.ts';
import { capabilityDiff, roleProposalSummary, skillProposalSummary } from '../summary.ts';

const role = {
  id: 'writer',
  name: 'Writer',
  instructions: 'Draft the packet.',
  capabilities: { ...capabilityDefaults },
} as unknown as Role;

const proposal = (changes: RoleProposal['changes']) =>
  ({ id: 'p', roleId: 'writer', changes }) as unknown as RoleProposal;

describe('capabilityDiff', () => {
  it('keeps only capabilities that would change', () => {
    const { changed, unchanged } = capabilityDiff(role, {
      ...capabilityDefaults,
      readApplications: true,
    });
    expect(changed).toEqual([
      expect.objectContaining({ key: 'readApplications', before: false, after: true }),
    ]);
    expect(unchanged).toBe(Object.keys(capabilityDefaults).length - 1);
  });
});

describe('roleProposalSummary', () => {
  it('names instruction and capability changes in one sentence', () => {
    expect(
      roleProposalSummary(
        proposal({
          instructions: 'Draft the packet.\n\nRun the packet rules first.',
          capabilities: { ...capabilityDefaults, readApplications: true },
        }),
        role,
      ),
    ).toBe('Adds 1 paragraph to the instructions and turns on 1 capability.');
  });

  it('describes rewrites, removals and no-ops', () => {
    expect(roleProposalSummary(proposal({ instructions: 'Write a draft.' }), role)).toBe(
      'Changes 1 paragraph in the instructions.',
    );
    expect(roleProposalSummary(proposal({ instructions: '' }), role)).toBe(
      'Removes 1 paragraph from the instructions.',
    );
    expect(roleProposalSummary(proposal({ instructions: role.instructions }), role)).toBe(
      'Leaves the current settings as they are.',
    );
  });
});

describe('skillProposalSummary', () => {
  it('names the skill and who receives it', () => {
    const skill = { name: 'Openings', scope: 'roles', roleIds: ['writer', 'reviewer'] };
    const names = (id: string) => id[0].toUpperCase() + id.slice(1);
    expect(skillProposalSummary({ skill } as unknown as SkillProposal, names)).toBe(
      'Adds “Openings” for Writer and Reviewer.',
    );
    expect(
      skillProposalSummary(
        { skill: { ...skill, scope: 'all', roleIds: [] } } as unknown as SkillProposal,
        names,
      ),
    ).toBe('Adds “Openings” for all agents.');
  });
});
