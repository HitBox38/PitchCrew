import { randomUUID } from 'node:crypto';
import {
  delegationRoundLimits,
  type AgentTask,
  type DelegationRound,
  type RoleId,
} from '@pitchcrew/core';
import { agentDm, conversation } from './conversations.ts';
import { requireRole } from './role-lookup.ts';
import type { CrewContext } from './types.ts';

export interface RoundRequest {
  leadId: RoleId;
  threadId: string;
  cardId: string | null;
  initiator: 'user' | RoleId;
  parentRunId: string | null;
  requestId: string | null;
  rootRunId: string;
  delegates: { roleId: RoleId; content: string; conversationId?: string }[];
}
/** Validate every delegate before saving the round, its subtasks and its collection turn together. */
export const startRound = (context: CrewContext, input: RoundRequest): DelegationRound => {
  if (!input.delegates.length || input.delegates.length > delegationRoundLimits.delegates)
    throw new Error(`A delegation round holds 1 to ${delegationRoundLimits.delegates} delegates.`);
  const seen = new Set<string>();
  for (const delegate of input.delegates) {
    if (delegate.roleId === input.leadId)
      throw new Error('The lead cannot be its own delegate. Choose other crew members.');
    if (seen.has(delegate.roleId))
      throw new Error(`${delegate.roleId} appears twice. Give each delegate one subtask.`);
    seen.add(delegate.roleId);
    const role = requireRole(context, delegate.roleId);
    if (role.retiredAt) throw new Error(`${role.name} is retired and cannot take a subtask.`);
    if (!role.enabled) throw new Error(`${role.name} is paused. Resume it in Crew first.`);
    if (!context.runtimes.find((runtime) => runtime.id === role.runtime)?.available)
      throw new Error(`${role.name}'s runtime is not available.`);
    if (delegate.conversationId) {
      const target = conversation(context, delegate.conversationId);
      if (
        !target.participants.includes(input.leadId) ||
        !target.participants.includes(delegate.roleId) ||
        target.cardId !== input.cardId ||
        target.kind === 'history'
      )
        throw new Error(`Choose a shared conversation with ${role.name} and the same job scope.`);
    }
  }
  const createdAt = new Date().toISOString();
  const roundId = randomUUID();
  const anchor = input.parentRunId ?? input.requestId ?? input.rootRunId;
  const tasks: AgentTask[] = input.delegates.map((delegate) => ({
    id: randomUUID(),
    parentRunId: anchor,
    rootRunId: input.rootRunId,
    roleId: delegate.roleId,
    cardId: input.cardId,
    mode: 'chat',
    trigger: 'invoke',
    threadId:
      delegate.conversationId ??
      agentDm(context, input.leadId, delegate.roleId, input.cardId, input.threadId).id,
    content: delegate.content,
    status: 'queued',
    runId: null,
    error: '',
    createdAt,
    roundId,
    roundPart: 'delegate',
  }));
  const collection: AgentTask = {
    id: randomUUID(),
    parentRunId: anchor,
    rootRunId: input.rootRunId,
    roleId: input.leadId,
    cardId: input.cardId,
    mode: 'chat',
    trigger: 'invoke',
    threadId: input.threadId,
    content: '',
    status: 'queued',
    runId: null,
    error: '',
    createdAt,
    roundId,
    roundPart: 'collection',
  };
  const round: DelegationRound = {
    id: roundId,
    threadId: input.threadId,
    cardId: input.cardId,
    leadId: input.leadId,
    initiator: input.initiator,
    rootRunId: input.rootRunId,
    parentRunId: input.parentRunId,
    requestId: input.requestId,
    delegates: tasks.map((task) => ({
      roleId: task.roleId,
      taskId: task.id,
      threadId: task.threadId,
    })),
    collectionTaskId: collection.id,
    status: 'queued',
    createdAt,
    settledAt: null,
  };
  const actor = input.initiator === 'user' ? 'user' : input.leadId;
  context.board.db.transaction(() => {
    context.board.record(
      'delegation_round',
      round,
      actor,
      `${actor} started a delegation round with ${tasks.map((task) => task.roleId).join(', ')}`,
    );
    for (const task of tasks) {
      context.board.record('task', task, actor, `${actor} delegated a subtask to ${task.roleId}`);
      context.addMessage(
        task.threadId,
        input.initiator === 'user' ? 'user' : input.leadId,
        task.roleId,
        task.content,
        input.cardId,
        input.parentRunId,
      );
    }
    context.board.record('task', collection, actor, `${input.leadId} will collect the results`);
  })();
  return round;
};
