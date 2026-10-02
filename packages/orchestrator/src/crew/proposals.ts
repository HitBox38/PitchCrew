import { type Role, type RoleProposal, type SkillProposal } from '@pitchcrew/core';
import { z } from 'zod';
import type { CrewContext } from './types.ts';

export async function decideProposal(
  this: CrewContext,
  id: string,
  approved: boolean,
): Promise<RoleProposal> {
  if (this.deciding.has(id)) throw new Error('This proposal is being decided.');
  const proposal = this.board.get<RoleProposal>('proposal', id);
  if (proposal.status !== 'pending') throw new Error('This proposal has already been decided.');
  this.deciding.add(id);
  try {
    if (approved) {
      const role = this.board.get<Role>('role', proposal.roleId);
      await this.configureRole(role.id, { ...role, ...proposal.changes });
    }
    const next: RoleProposal = { ...proposal, status: approved ? 'applied' : 'rejected' };
    this.board.record(
      'proposal',
      next,
      'user',
      `${approved ? 'Applied' : 'Rejected'} ${proposal.roleId}’s proposed changes`,
    );
    this.addMessage(
      proposal.roleId,
      'system',
      proposal.roleId,
      approved
        ? 'Your proposed changes were applied by the user.'
        : 'Your proposed changes were declined by the user.',
      null,
      null,
    );
    return next;
  } finally {
    this.deciding.delete(id);
  }
}
export function decideSkillProposal(
  this: CrewContext,
  id: string,
  approved: boolean,
): SkillProposal {
  return this.board.db.transaction(() => {
    const proposal = this.board.get<SkillProposal>('skill_proposal', z.uuid().parse(id));
    if (proposal.status !== 'pending') throw new Error('This proposal has already been decided.');
    // Save the reviewed snapshot; approving never fetches a potentially changed remote file.
    const skill = approved ? this.saveSkill(proposal.skill) : null;
    const next: SkillProposal = {
      ...proposal,
      status: approved ? 'applied' : 'rejected',
      skillId: skill?.id ?? null,
    };
    this.board.record(
      'skill_proposal',
      next,
      'user',
      `${approved ? 'Added' : 'Declined'} suggested skill: ${proposal.skill.name}`,
    );
    this.addMessage(
      proposal.threadId,
      'system',
      proposal.threadId,
      `${approved ? 'Added' : 'Declined'} the suggested skill “${proposal.skill.name}”.${approved ? ' It applies to new runs.' : ''}`,
      null,
      null,
    );
    return next;
  })();
}
