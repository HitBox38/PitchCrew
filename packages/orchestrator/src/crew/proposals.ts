import {
  defaultCapabilities,
  type ChatMessage,
  type Role,
  type RoleProposal,
  type SkillProposal,
} from '@pitchcrew/core';
import { configRevision } from './pipeline/snapshots.ts';
import { z } from 'zod';
import type { CrewContext } from './types.ts';

export const decideProposal = async (
  context: CrewContext,
  id: string,
  approved: boolean,
): Promise<RoleProposal> => {
  if (context.deciding.has(id)) throw new Error('This proposal is being decided.');
  const proposal = context.board.get<RoleProposal>('proposal', id);
  if (proposal.status !== 'pending') throw new Error('This proposal has already been decided.');
  context.deciding.add(id);
  let sourceLocked = false;
  try {
    if (approved) {
      const role = context.board.get<Role>('role', proposal.roleId);
      if (proposal.targetRevision && configRevision(role) !== proposal.targetRevision)
        throw new Error(
          'Target role settings changed. Decline this stale proposal and request a new one.',
        );
      if (proposal.sourceRoleId) {
        const source = context.board.get<Role>('role', proposal.sourceRoleId);
        const permissions = source.capabilities ?? defaultCapabilities;
        if (
          !source.enabled ||
          permissions.proposeCrewChanges !== true ||
          permissions.reviewPipeline !== true ||
          ('retiredAt' in source && source.retiredAt)
        )
          throw new Error('The originating role no longer has permission to propose crew changes.');
        if (!role.enabled || ('retiredAt' in role && role.retiredAt))
          throw new Error('The target role is disabled or retired.');
        const notice = proposal.noticeMessageId
          ? context.board.get<ChatMessage>('message', proposal.noticeMessageId)
          : null;
        if (
          !notice ||
          notice.notification !== 'attention' ||
          notice.from !== proposal.sourceRoleId ||
          notice.to !== 'user' ||
          notice.runId !== proposal.runId ||
          notice.createdAt > proposal.createdAt
        )
          throw new Error(
            'The user must receive this proposal notice before adopting crew changes.',
          );
        if (source.id !== role.id) {
          if (context.configuring.has(source.id))
            throw new Error('Wait for the originating role settings update.');
          context.configuring.add(source.id);
          sourceLocked = true;
        }
      }
      await context.configureRole(role.id, { ...role, ...proposal.changes });
    }
    const next: RoleProposal = { ...proposal, status: approved ? 'applied' : 'rejected' };
    context.board.record(
      'proposal',
      next,
      'user',
      `${approved ? 'Applied' : 'Rejected'} ${proposal.roleId}’s proposed changes`,
    );
    context.addMessage(
      proposal.sourceRoleId ?? proposal.roleId,
      'system',
      proposal.sourceRoleId ?? proposal.roleId,
      approved
        ? 'Your proposed changes were applied by the user.'
        : 'Your proposed changes were declined by the user.',
      null,
      null,
    );
    return next;
  } finally {
    context.deciding.delete(id);
    if (sourceLocked) context.configuring.delete(proposal.sourceRoleId!);
  }
};
export const decideSkillProposal = (
  context: CrewContext,
  id: string,
  approved: boolean,
): SkillProposal => {
  return context.board.db.transaction(() => {
    const proposal = context.board.get<SkillProposal>('skill_proposal', z.uuid().parse(id));
    if (proposal.status !== 'pending') throw new Error('This proposal has already been decided.');
    // Save the reviewed snapshot; approving never fetches a potentially changed remote file.
    const skill = approved ? context.saveSkill(proposal.skill) : null;
    const next: SkillProposal = {
      ...proposal,
      status: approved ? 'applied' : 'rejected',
      skillId: skill?.id ?? null,
    };
    context.board.record(
      'skill_proposal',
      next,
      'user',
      `${approved ? 'Added' : 'Declined'} suggested skill: ${proposal.skill.name}`,
    );
    context.addMessage(
      proposal.threadId,
      'system',
      proposal.threadId,
      `${approved ? 'Added' : 'Declined'} the suggested skill “${proposal.skill.name}”.${approved ? ' It applies to new runs.' : ''}`,
      null,
      null,
    );
    return next;
  })();
};
