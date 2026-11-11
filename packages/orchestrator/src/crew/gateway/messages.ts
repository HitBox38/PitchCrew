import { conversationMessages } from '../conversation-context.ts';
import { conversation, canReadConversation } from '../conversations.ts';
import type { AgentCapabilities } from '@pitchcrew/core';
import { delegationRoundInput, roleIdSchema, type Run } from '@pitchcrew/core';
import { startRound } from '../delegation-rounds.ts';
import { z } from 'zod';
import type { CrewContext, RunCapability } from '../types.ts';

export const readMessages = async (
  context: CrewContext,
  capability: RunCapability,
): Promise<Record<string, unknown>> => {
  const run = context.board.get<import('@pitchcrew/core').Run>('run', capability.runId);
  // Distinct threads in first-message order, read from the thread index alone.
  const threads = (
    context.board.db
      .prepare(
        "SELECT json_extract(json,'$.threadId') AS threadId FROM entities WHERE kind='message' GROUP BY 1 ORDER BY min(rowid)",
      )
      .all() as { threadId: string }[]
  )
    .map((row) => row.threadId)
    .filter((id) => canReadConversation(context, capability.roleId, id));
  return {
    messages: threads
      .flatMap((id) => conversationMessages(context, id, capability.roleId, run.requestId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-100),
  };
};
export const queueMessage = async (
  context: CrewContext,
  capability: RunCapability,
  permissions: AgentCapabilities,
  action: 'message' | 'invoke',
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  if (!permissions[action === 'message' ? 'messageAgents' : 'invokeAgents'])
    throw new Error('This capability is disabled for your role.');
  const input = z
    .object({
      roleId: roleIdSchema,
      content: z.string().trim().min(1).max(8000),
      mode: z.enum(['chat', 'workflow']).default('chat'),
      conversationId: z.string().optional(),
    })
    .parse(data);
  if (input.mode === 'workflow' && !permissions.manageWorkflow)
    throw new Error('Workflow capability is disabled for your role.');
  if (input.conversationId) {
    const target = conversation(context, input.conversationId);
    if (
      !target.participants.includes(capability.roleId) ||
      !target.participants.includes(input.roleId) ||
      target.cardId !== capability.cardId ||
      target.kind === 'history'
    )
      throw new Error('Choose a shared conversation with the same job scope.');
  }
  const mode = action === 'message' ? 'chat' : input.mode;
  const task = context.enqueue(
    capability,
    input.roleId,
    mode,
    input.content,
    action,
    input.conversationId,
  );
  return mode === 'workflow' ? { task, delivered: false, note: workflowContentNote } : { task };
};

// Isolated workflow runs never see free-form crew text; say so instead of implying delivery.
const workflowContentNote =
  'Content is a visible handoff note only and is not sent to the isolated workflow run. To deliver a user correction to the Writer, use pitchcrew_application_quality with action writing_correct, the user message ID and an exact quote.';

/** A lead assigns chat-only subtasks to several agents and collects every result in one turn. */
export const delegateRound = (
  context: CrewContext,
  capability: RunCapability,
  permissions: AgentCapabilities,
  activeRun: Run | undefined,
  data: unknown,
): Record<string, unknown> => {
  if (!permissions.invokeAgents) throw new Error('This capability is disabled for your role.');
  if (!activeRun || activeRun.status !== 'running')
    throw new Error('Delegation rounds require an active chat turn.');
  if (
    activeRun.mode !== 'chat' ||
    activeRun.purpose ||
    activeRun.deepReviewId ||
    !activeRun.threadId
  )
    throw new Error(
      'Delegation rounds start from ordinary chat turns, not workflow or review stages.',
    );
  const input = delegationRoundInput.parse(data);
  const round = startRound(context, {
    leadId: capability.roleId,
    threadId: activeRun.threadId,
    cardId: capability.cardId,
    initiator: capability.roleId,
    parentRunId: activeRun.id,
    requestId: null,
    rootRunId: activeRun.rootRunId ?? activeRun.id,
    delegates: input.delegates,
  });
  return {
    round: {
      id: round.id,
      delegates: round.delegates,
      note: 'Delegates start after this turn ends and run at the same time. You will get one collection turn with every result; do not wait or poll for them now.',
    },
  };
};

export const notifyUser = (
  context: CrewContext,
  capability: RunCapability,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const input = z
    .object({
      content: z.string().trim().min(1).max(8000),
      kind: z.enum(['message', 'attention']),
      action: z.literal('notify_user').optional(),
    })
    .strict()
    .parse(data);
  // Count in SQLite instead of parsing every saved message.
  const { sent } = context.board.db
    .prepare(
      "SELECT count(*) AS sent FROM entities WHERE kind='message' AND json_extract(json,'$.runId')=? AND json_extract(json,'$.notification') IS NOT NULL AND json_extract(json,'$.notification') NOT IN ('',0)",
    )
    .get(capability.runId) as { sent: number };
  if (sent >= 3) throw new Error('Three user notifications maximum per run.');
  const run = context.board.get<import('@pitchcrew/core').Run>('run', capability.runId);
  return {
    message: context.addMessage(
      run.threadId ?? capability.roleId,
      capability.roleId,
      'user',
      input.content,
      capability.cardId,
      capability.runId,
      undefined,
      input.kind,
    ),
  };
};
