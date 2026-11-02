import { z } from 'zod';
import { roleIdSchema } from './roles.ts';
import type { RoleId } from './states.ts';
import type { AgentTask } from './runs.ts';

/** One lead assigns subtasks to several agents at once and collects every result in one turn. */
export interface DelegationRound {
  id: string;
  /** Conversation where the round was requested and where the collection turn replies. */
  threadId: string;
  cardId: string | null;
  leadId: RoleId;
  /** The user, or the role whose run started the round. */
  initiator: 'user' | RoleId;
  /** Chain root shared with ordinary follow-ups: a run or a chat request. */
  rootRunId: string;
  /** Lead run that started the round; absent for user-initiated rounds. */
  parentRunId: string | null;
  /** Chat request anchoring a user-initiated round in its conversation. */
  requestId: string | null;
  delegates: { roleId: RoleId; taskId: string; threadId: string }[];
  collectionTaskId: string;
  status: 'queued' | 'running' | 'collecting' | 'completed' | 'cancelled';
  createdAt: string;
  settledAt: string | null;
}

export const delegationRoundLimits = {
  delegates: 4,
  /** Characters of each delegate's final reply carried into the collection prompt. */
  resultCharacters: 6000,
} as const;

export const delegationRoundInput = z
  .object({
    delegates: z
      .array(
        z
          .object({
            roleId: roleIdSchema,
            content: z.string().trim().min(1).max(8000),
            conversationId: z.string().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(delegationRoundLimits.delegates),
  })
  .strict();
export type DelegationRoundInput = z.infer<typeof delegationRoundInput>;

export const userDelegationInput = z
  .object({
    content: z.string().trim().min(1).max(8000),
    roleIds: z.array(roleIdSchema).min(1).max(delegationRoundLimits.delegates),
  })
  .strict();

/** Follow-ups charged to a chain: every ordinary task plus one per delegation round. */
export const chainFollowUpCount = (
  tasks: Pick<AgentTask, 'rootRunId' | 'roundId'>[],
  rootRunId: string,
) => {
  const rounds = new Set<string>();
  let ordinary = 0;
  for (const task of tasks) {
    if (task.rootRunId !== rootRunId) continue;
    if (task.roundId) rounds.add(task.roundId);
    else ordinary += 1;
  }
  return ordinary + rounds.size;
};
export const chainFollowUpLimit = 6;
