import type { Card, ChatRequest, Run } from '@pitchcrew/core';
import { z } from 'zod';
import { skillDigest } from '../chat-references.ts';
import { canReadConversation } from '../conversations.ts';
import { questionForRun } from '../user-input/lifecycle.ts';
import type { CrewContext, RunCapability } from '../types.ts';

/** Discovery and execution share the same eligibility; source-only turns never gain a reader. */
export const canReadRunSkills = (context: CrewContext, run: Run | undefined): boolean => {
  if (
    context.closing ||
    !run ||
    run.status !== 'running' ||
    !run.configuration ||
    run.configuration.role.id !== run.roleId ||
    run.purpose === 'source-extraction' ||
    run.reviewBudgetRequest ||
    questionForRun(context, run.id)
  )
    return false;
  const controller = context.controllers.get(run.id);
  if (!controller || controller.signal.aborted) return false;
  if (run.threadId && !canReadConversation(context, run.roleId, run.threadId)) return false;
  if (run.requestId && context.board.get<ChatRequest>('chat_request', run.requestId).summarize)
    return false;
  if (
    ['application-draft', 'application-review', 'fit', 'packet-evaluation'].includes(
      run.purpose ?? '',
    )
  ) {
    if (!run.cardId || !run.contextRevision) return false;
    const card = context.board.get<Card>('card', run.cardId);
    if (card.applicationContext?.revision !== run.contextRevision) return false;
  }
  return true;
};

export const readRunSkill = (
  context: CrewContext,
  capability: RunCapability,
  run: Run | undefined,
  data: unknown,
): Record<string, unknown> => {
  if (
    !run ||
    !run.configuration ||
    !canReadRunSkills(context, run) ||
    run.roleId !== capability.roleId ||
    run.cardId !== capability.cardId
  )
    throw new Error('Skill instructions are unavailable for this run.');
  const { skillId } = z.object({ skillId: z.uuid() }).strict().parse(data);
  const skill = run.configuration.skills.find(
    (skill) =>
      skill.id === skillId && (skill.scope === 'all' || skill.roleIds.includes(capability.roleId)),
  );
  if (!skill) throw new Error('This skill is not assigned to this run.');
  // Only the immutable run snapshot is authoritative. Saved edits and upstream changes apply
  // to future runs, and a read never exposes another role's skills or any broader board data.
  return {
    skill: {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      content: skill.content,
    },
    digest: skillDigest(skill),
  };
};
