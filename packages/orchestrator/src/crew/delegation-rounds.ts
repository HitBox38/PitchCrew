import { randomUUID } from 'node:crypto';
import {
  chainFollowUpCount,
  chainFollowUpLimit,
  delegationRoundLimits,
  type AgentTask,
  type ChatMessage,
  type DelegationRound,
  type RoleId,
  type Run,
} from '@pitchcrew/core';
import { agentDm, conversation } from './conversations.ts';
import { requireRole } from './roles.ts';
import type { CrewContext } from './types.ts';

const settled = (status: AgentTask['status']) =>
  ['completed', 'failed', 'cancelled'].includes(status);

/** A task's parent run; absent when a user-initiated round anchors the task to a chat request. */
export const taskParentRun = (context: CrewContext, task: AgentTask): Run | undefined => {
  const row = context.board.db
    .prepare("SELECT json FROM entities WHERE kind='run' AND id=?")
    .get(task.parentRunId) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as Run) : undefined;
};
export const roundOf = (context: CrewContext, task: AgentTask): DelegationRound | undefined => {
  if (!task.roundId) return undefined;
  const row = context.board.db
    .prepare("SELECT json FROM entities WHERE kind='delegation_round' AND id=?")
    .get(task.roundId) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as DelegationRound) : undefined;
};
export const roundDelegateTasks = (context: CrewContext, round: DelegationRound): AgentTask[] =>
  round.delegates.flatMap((delegate) => {
    const row = context.board.db
      .prepare("SELECT json FROM entities WHERE kind='task' AND id=?")
      .get(delegate.taskId) as { json: string } | undefined;
    return row ? [JSON.parse(row.json) as AgentTask] : [];
  });
/** The run is a delegate's subtask turn, which cannot delegate, message or invite further. */
export const runIsDelegate = (context: CrewContext, run: Run | undefined): boolean => {
  if (!run?.taskId) return false;
  const row = context.board.db
    .prepare("SELECT json FROM entities WHERE kind='task' AND id=?")
    .get(run.taskId) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as AgentTask).roundPart === 'delegate' : false;
};
/**
 * Parent readiness for follow-ups, including round members: delegates wait for the lead's run,
 * the collection waits for every delegate to settle, and user-initiated rounds have no lead run.
 */
export const taskParentReady = (context: CrewContext, task: AgentTask, runs?: Run[]): boolean => {
  const parent = runs
    ? runs.find((run) => run.id === task.parentRunId)
    : taskParentRun(context, task);
  if (parent ? parent.status !== 'completed' : !task.roundId) return false;
  if (!task.roundId) return true;
  const round = roundOf(context, task);
  if (!round || round.status === 'cancelled') return false;
  if (task.roundPart === 'delegate') return true;
  return roundDelegateTasks(context, round).every((delegate) => settled(delegate.status));
};
export const assertFollowUpBudget = (context: CrewContext, rootRunId: string): void => {
  if (chainFollowUpCount(context.board.list<AgentTask>('task'), rootRunId) >= chainFollowUpLimit)
    throw new Error(
      'This run chain reached its six follow-up limit. Ask the user to start another turn.',
    );
};

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
  assertFollowUpBudget(context, input.rootRunId);
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

const delegateReply = (context: CrewContext, task: AgentTask): string => {
  if (!task.runId) return '';
  const reply = context.board
    .list<ChatMessage>('message')
    .findLast((message) => message.runId === task.runId && message.from === task.roleId);
  return reply?.content ?? '';
};
/** The lead's collection prompt: every delegate result, bounded, with pointers to the full DMs. */
export const collectionPrompt = (context: CrewContext, round: DelegationRound): string => {
  const limit = delegationRoundLimits.resultCharacters;
  const results = roundDelegateTasks(context, round).map((task) => {
    const name = requireRole(context, task.roleId).name;
    const reply = delegateReply(context, task);
    const truncated = reply.length > limit;
    const body =
      task.status === 'completed'
        ? reply
          ? `${reply.slice(0, limit)}${truncated ? `\n[Truncated after ${limit} characters. Read conversation ${task.threadId} for the rest.]` : ''}`
          : '(no reply text)'
        : `Result unavailable: ${task.error || (task.status === 'cancelled' ? 'stopped before finishing' : 'the subtask failed')}.`;
    return `### ${name} (${task.roleId}) — ${task.status}\nSubtask: ${task.content}\nConversation: ${task.threadId}\n${body}`;
  });
  return `Delegation round results. Every delegate has finished. Synthesize these for the user in this conversation, state plainly which delegates failed or were stopped, and read a listed conversation with pitchcrew_read_conversation only if you need details beyond what is here.\n\n${results.join('\n\n')}`;
};
/** Recompute a round's status from its tasks after any task settles or is cancelled. */
export const refreshRound = (context: CrewContext, roundId: string): void => {
  const row = context.board.db
    .prepare("SELECT json FROM entities WHERE kind='delegation_round' AND id=?")
    .get(roundId) as { json: string } | undefined;
  if (!row) return;
  const round = JSON.parse(row.json) as DelegationRound;
  if (['completed', 'cancelled'].includes(round.status)) return;
  const delegates = roundDelegateTasks(context, round);
  const collection = context.board.get<AgentTask>('task', round.collectionTaskId);
  const status: DelegationRound['status'] =
    collection.status === 'completed'
      ? 'completed'
      : ['failed', 'cancelled'].includes(collection.status)
        ? 'cancelled'
        : delegates.every((task) => settled(task.status))
          ? 'collecting'
          : delegates.some((task) => task.status !== 'queued')
            ? 'running'
            : 'queued';
  if (status === round.status) return;
  context.board.record(
    'delegation_round',
    {
      ...round,
      status,
      settledAt: ['completed', 'cancelled'].includes(status) ? new Date().toISOString() : null,
    },
    'system',
    `Delegation round ${status}`,
  );
};
/** Chain roots of unsettled rounds requested in a conversation, so Stop reaches user-started rounds. */
export const openRoundRoots = (context: CrewContext, threadId: string): string[] =>
  context.board
    .list<DelegationRound>('delegation_round')
    .filter(
      (round) => round.threadId === threadId && !['completed', 'cancelled'].includes(round.status),
    )
    .map((round) => round.rootRunId);
export const refreshOpenRounds = (context: CrewContext): void => {
  for (const round of context.board.list<DelegationRound>('delegation_round'))
    if (!['completed', 'cancelled'].includes(round.status)) refreshRound(context, round.id);
};
/** Reply addressee for a task's run: the user for collections, the lead for delegates. */
export const taskReplyTarget = (context: CrewContext, task: AgentTask): ChatMessage['to'] => {
  if (task.roundPart === 'collection') return 'user';
  if (task.roundPart === 'delegate') return roundOf(context, task)?.leadId ?? 'user';
  return taskParentRun(context, task)?.roleId ?? 'user';
};
export const delegationContext = (context: CrewContext, task: AgentTask | undefined) => {
  if (!task?.roundPart) return undefined;
  const round = roundOf(context, task);
  if (!round) return undefined;
  return {
    part: task.roundPart,
    leadId: round.leadId,
    initiator: round.initiator,
    delegates: round.delegates.map((delegate) => delegate.roleId),
  };
};
