import {
  roleChanges,
  skillInput,
  skillSuggestionInput,
  type Role,
  type RoleProposal,
  type Run,
  type SkillProposal,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { skillDirectory } from '../../skills-directory.ts';
import type { CrewContext, RunCapability } from '../types.ts';

export async function proposeRole(
  this: CrewContext,
  capability: RunCapability,
  role: Role,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const input = z
    .object({ reason: z.string().trim().min(1).max(2000), changes: roleChanges })
    .parse(data);
  if (
    this.board.list<RoleProposal>('proposal').filter((p) => p.runId === capability.runId).length >=
    3
  )
    throw new Error('Three proposals maximum per run.');
  const proposal: RoleProposal = {
    id: randomUUID(),
    roleId: capability.roleId,
    runId: capability.runId,
    ...input,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  this.board.record(
    'proposal',
    proposal,
    capability.roleId,
    `${role.name} proposed changes to its settings`,
  );
  return { proposal };
}
export async function proposeSkill(
  this: CrewContext,
  capability: RunCapability,
  role: Role,
  token: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const input = z
    .object({ reason: z.string().trim().min(1).max(2000), suggestion: skillSuggestionInput })
    .parse(data);
  const proposalCount = () =>
    this.board.list<SkillProposal>('skill_proposal').filter((p) => p.runId === capability.runId)
      .length;
  if (proposalCount() >= 3) throw new Error('Three skill suggestions maximum per run.');
  const skill =
    input.suggestion.kind === 'custom'
      ? skillInput.parse(input.suggestion.skill)
      : skillInput.parse({
          ...(await skillDirectory.preview(
            input.suggestion.url,
            this.controllers.get(capability.runId)?.signal,
          )),
          ...input.suggestion.assignment,
        });
  if (
    this.closing ||
    this.capabilities.get(token) !== capability ||
    this.controllers.get(capability.runId)?.signal.aborted
  )
    throw new Error('Run capability is invalid or expired.');
  if (proposalCount() >= 3) throw new Error('Three skill suggestions maximum per run.');
  const run = this.board.get<Run>('run', capability.runId);
  const proposal: SkillProposal = {
    id: randomUUID(),
    roleId: capability.roleId,
    runId: capability.runId,
    threadId: run.threadId ?? 'crew',
    reason: input.reason,
    skill,
    status: 'pending',
    skillId: null,
    createdAt: new Date().toISOString(),
  };
  this.board.record(
    'skill_proposal',
    proposal,
    capability.roleId,
    `${role.name} suggested adding skill: ${skill.name}`,
  );
  this.addMessage(
    proposal.threadId,
    capability.roleId,
    proposal.threadId,
    `I suggest adding the skill “${skill.name}”. ${input.reason}\n\nReview its instructions and assignment in Crew work before adding it.`,
    capability.cardId,
    capability.runId,
  );
  return { proposal };
}
