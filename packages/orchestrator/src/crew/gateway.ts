import { subagentCard } from './deep-reviews/inputs.ts';
import { qualityAgentAction } from '../quality/agent.ts';
import { inspectPacketDocuments } from '../quality/documents.ts';
import { startDeepReview } from './deep-reviews/index.ts';
import { reviewAgentAction } from './deep-reviews/subagents.ts';
import { randomUUID } from 'node:crypto';
import { recordChatActivity } from './chat-activity.ts';
import { observeChatTool } from './gateway/activity.ts';
import { askUser } from './user-input/questions.ts';
import { questionForRun } from './user-input/lifecycle.ts';
import { conversationAction, memoryAction } from './gateway/conversations.ts';
import { canReadConversation } from './conversations.ts';
import { requireRole } from './roles.ts';
import { readChatAttachment } from './gateway/attachments.ts';
import {
  defaultCapabilities,
  checkLinkedInDraft,
  describePacketRules,
  workflowSeat,
  draftingCard,
  runResultSchema,
  reviewPerspectiveSchema,
  type Approval,
  type Card,
  type Role,
} from '@pitchcrew/core';
import { checkLayout, readProfile, systemFonts } from '@pitchcrew/packet';
import { z } from 'zod';
import { join } from 'node:path';
import { pipelineAction } from './gateway/pipeline.ts';
import { computerAction } from './gateway/computer.ts';
import { connectorAccess, connectorAction } from './gateway/connectors.ts';
import { notifyUser, queueMessage, readMessages } from './gateway/messages.ts';
import { proposeRole, proposeSkill } from './gateway/proposals.ts';
import { changeWorkflow } from './gateway/workflow.ts';
import { correctJobDetails } from './gateway/job-details.ts';
import { profileAction } from './gateway/profile.ts';
import { routineAction } from './gateway/routines.ts';
import { trackingAction } from './gateway/tracking.ts';
import { insightsAction } from './gateway/insights.ts';
import { jobSourceAction } from './gateway/job-sources.ts';
import type { CrewContext } from './types.ts';
import { beginMcpToolCall } from '../telemetry/mcp.ts';
import { reportTechnicalProblem } from './gateway/diagnostics.ts';

export const agentCall = async (
  context: CrewContext,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  let finish: (isError: boolean) => void = () => {};
  try {
    finish = beginMcpToolCall(context, token, action, data);
  } catch {
    // Telemetry initialization must never prevent a scoped tool invocation.
  }
  const finishActivity = observeChatTool(context, token, action);
  let isError = true;
  try {
    const result = await dispatchAgentCall(context, token, action, data);
    isError = false;
    return result;
  } finally {
    finishActivity(isError);
    finish(isError);
  }
};

const dispatchAgentCall = async (
  context: CrewContext,
  token: string,
  action: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const capability = context.capabilities.get(token);
  if (!capability || context.controllers.get(capability.runId)?.signal.aborted)
    throw new Error('Run capability is invalid or expired.');
  const role = requireRole(context, capability.roleId);
  if (!role.enabled) throw new Error('This role is paused.');
  const permissions = role.capabilities ?? defaultCapabilities;
  const activeRun = context.board
    .list<import('@pitchcrew/core').Run>('run')
    .find((run) => run.id === capability.runId);
  if (action === 'execution_access') {
    if (!activeRun || activeRun.status !== 'running')
      throw new Error('Run capability is invalid or expired.');
    return {
      purpose: activeRun.purpose ?? null,
      reviewMode: activeRun.deepReviewId
        ? activeRun.reviewSubagentId
          ? 'subagent'
          : activeRun.configuration?.role.workflow === 'writer'
            ? 'writer'
            : activeRun.reviewBudgetRequest
              ? 'budget'
              : 'parent'
        : null,
    };
  }
  if (activeRun?.purpose === 'source-extraction')
    throw new Error(
      'Source extraction cannot call agent tools. Return only the structured source result.',
    );
  if (action === 'report_technical_problem') {
    if (!activeRun || activeRun.status !== 'running' || questionForRun(context, capability.runId))
      throw new Error('Technical problem reports require an active run.');
    if (activeRun.threadId && !canReadConversation(context, capability.roleId, activeRun.threadId))
      throw new Error('Conversation access was removed.');
    return reportTechnicalProblem(context, capability, data.input ?? data);
  }
  const isolated =
    activeRun?.purpose === 'application-draft' ||
    activeRun?.purpose === 'application-review' ||
    activeRun?.purpose === 'fit' ||
    activeRun?.purpose === 'packet-evaluation';
  if (
    activeRun?.reviewBudgetRequest &&
    !['card', 'profile', 'packet_rules', 'lint', 'notify_user', 'extend_review_deadline'].includes(
      action,
    )
  )
    throw new Error('A review deadline decision cannot perform this action.');
  if (activeRun?.reviewSubagentId && ['ask_user', 'notify_user'].includes(action))
    throw new Error(
      'Review subagents return findings to the parent; only the parent asks the user.',
    );
  const reviewActions = [
    'start_review_subagent',
    'review_subagents',
    'extend_review_deadline',
    'request_review_time',
  ];
  if (activeRun?.deepReviewId && reviewActions.includes(action))
    return reviewAgentAction(context, capability, action, data.input ?? data);
  if (
    isolated &&
    !['card', 'profile', 'packet_rules', 'lint', 'ask_user', 'notify_user'].includes(action)
  )
    throw new Error('This tool is not available in an isolated application run.');
  if (isolated) {
    const card = context.board.get<Card>('card', capability.cardId!);
    if (card.applicationContext?.revision !== activeRun.contextRevision)
      throw new Error('Application context changed during this run.');
  }
  if (activeRun?.threadId && !canReadConversation(context, capability.roleId, activeRun.threadId))
    throw new Error('Conversation access was removed.');
  if (
    activeRun?.requestId &&
    context.board.get<import('@pitchcrew/core').ChatRequest>('chat_request', activeRun.requestId)
      .summarize &&
    ![
      'messages',
      'conversation_messages',
      'conversations',
      'roles',
      'profile',
      'chat_attachment',
      'recall_memory',
    ].includes(action)
  )
    throw new Error('Summarization turns can only read their permitted context.');
  if (
    questionForRun(context, capability.runId) &&
    ![
      'messages',
      'conversation_messages',
      'conversations',
      'roles',
      'profile',
      'chat_attachment',
      'recall_memory',
    ].includes(action)
  )
    throw new Error('This turn is waiting for user input. End the turn now.');
  if (action === 'check_linkedin_draft') {
    if (activeRun?.mode !== 'chat' || activeRun.status !== 'running')
      throw new Error('LinkedIn draft checks require an active chat turn.');
    return checkLinkedInDraft(data.input);
  }
  if (action === 'report_progress') {
    if (activeRun?.mode !== 'chat') throw new Error('Progress updates require a chat turn.');
    const { content } = z.object({ content: z.string().trim().min(1).max(1200) }).parse(data);
    const count =
      context.runActivities
        .get(capability.runId)
        ?.entries.filter((entry) => entry.id.startsWith('progress-')).length ?? 0;
    if (count >= 8) throw new Error('Eight progress updates maximum per turn.');
    recordChatActivity(context, capability.runId, {
      id: `progress-${randomUUID()}`,
      kind: 'commentary',
      label: 'Progress update',
      text: content,
      status: 'completed',
    });
    return { ok: true };
  }
  if (action === 'ask_user') return askUser(context, capability, data.input ?? data);
  if (
    [
      'conversations',
      'conversation_messages',
      'create_group',
      'invite_agent',
      'transfer_lead',
    ].includes(action)
  )
    return conversationAction(context, capability, action, data);
  if (['recall_memory', 'save_memory'].includes(action))
    return memoryAction(context, capability, action, data);
  if (action === 'application_insights')
    return insightsAction(context, capability, token, data.input);
  if (action === 'quality') return qualityAgentAction(context, capability, data.input);
  if (['applications', 'tracking_scan', 'tracking_reconcile'].includes(action))
    return trackingAction(context, capability, token, action, data);
  if (action === 'pipeline_access')
    return {
      reviewPipeline: role.enabled && permissions.reviewPipeline === true,
      proposeCrewChanges: role.enabled && permissions.proposeCrewChanges === true,
    };
  if (
    [
      'read_pipeline',
      'save_pipeline_review',
      'update_pipeline_review',
      'propose_crew_changes',
    ].includes(action)
  )
    return pipelineAction(context, capability, action, data.input);
  if (action === 'job_discovery_access')
    return { discoverJobs: role.enabled && permissions.discoverJobs === true };
  if (['job_sources', 'scan_job_sources', 'import_job_link'].includes(action))
    return jobSourceAction(context, capability, token, action, data);
  if (['routines', 'save_routine', 'delete_routine'].includes(action))
    return routineAction(context, capability, action, data);
  if (
    [
      'watched_profile_sources',
      'detect_profile_changes',
      'read_project_watch_file',
      'propose_profile_note',
    ].includes(action)
  )
    return profileAction(context, capability, token, action, data);
  if (action === 'computer_access')
    return {
      enabled: permissions.computerUse === true,
      assessForms: permissions.assessForms === true,
      recordSubmissions: permissions.recordSubmissions === true,
    };
  if (
    [
      'computer_inspect',
      'computer_wait',
      'computer_tabs',
      'computer_request',
      'computer_execute',
      'assess_form',
      'capture_submission',
    ].includes(action)
  )
    return computerAction(context, capability, token, action, data);
  if (action === 'connector_access') return connectorAccess(context, permissions);
  if (action === 'connector') return connectorAction(context, capability, permissions, data);
  if (action === 'notify_user') return notifyUser(context, capability, data);
  if (action === 'roles')
    return {
      roles: context.board
        .list<Role>('role')
        .filter((item) => !item.retiredAt)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          enabled: item.enabled,
          workflow: workflowSeat(item),
        })),
    };
  if (action === 'start_deep_review') {
    if (!permissions.invokeAgents || !permissions.manageWorkflow)
      throw new Error('Agent invocation and workflow permissions are required.');
    const input = z
      .object({
        cardId: z.uuid().optional(),
        secondOpinions: z.boolean().default(false),
        requestedPerspectives: z.array(reviewPerspectiveSchema).max(11).default([]),
      })
      .strict()
      .parse(data.input ?? data);
    const cardId = capability.cardId ?? input.cardId;
    if (!cardId) throw new Error('Ask the user to choose a job before starting deep review.');
    if (capability.cardId && input.cardId && input.cardId !== capability.cardId)
      throw new Error('Deep review is scoped to the attached job.');
    const run = await startDeepReview(
      context,
      cardId,
      { secondOpinions: input.secondOpinions, requestedPerspectives: input.requestedPerspectives },
      undefined,
      undefined,
      activeRun?.threadId,
      activeRun?.id,
    );
    return { run };
  }
  if (action === 'messages') return readMessages(context, capability);
  if (action === 'chat_attachment') return readChatAttachment(context, capability, token, data);
  if (action === 'message' || action === 'invoke')
    return queueMessage(context, capability, permissions, action, data);
  if (action === 'propose') return proposeRole(context, capability, role, data);
  if (action === 'propose_skill') return proposeSkill(context, capability, role, token, data);
  if (action === 'update_job') {
    if (!permissions.manageWorkflow)
      throw new Error('Workflow capability is disabled for your role.');
    return correctJobDetails(context, capability, data.input);
  }
  if (['jobs', 'workflow', 'delete_job', 'bulk_move_jobs', 'bulk_delete_jobs'].includes(action))
    return changeWorkflow(context, capability, permissions, action, data);
  if (['card', 'history', 'export'].includes(action) && !capability.cardId)
    throw new Error('This chat has no attached application.');
  if (action === 'card') {
    const card = context.board.get<Card>('card', capability.cardId!);
    return {
      card: isolated
        ? activeRun.reviewSubagentId
          ? subagentCard(draftingCard(card, activeRun.purpose))
          : draftingCard(card, activeRun.purpose)
        : card,
    };
  }
  if (action === 'profile') return { profile: await readProfile(context.directory) };
  if (action === 'history') {
    const query = z
      .object({
        beforeEventId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(data);
    const events = context.board.history(capability.cardId!, query.beforeEventId, query.limit);
    return { events, nextCursor: events.length === query.limit ? events.at(-1)!.id : null };
  }
  if (action === 'lint') {
    const parsed = runResultSchema.parse({ role: 'writer', packet: data.packet });
    if (parsed.role !== 'writer') throw new Error('Invalid packet.');
    const check = await context.packetRules.check(
      parsed.packet,
      await readProfile(context.directory),
    );
    return {
      problems: check.errors,
      warnings: check.warnings,
      findings: check.findings,
      documents: await inspectPacketDocuments(context.directory, parsed.packet),
      layout: await checkLayout(parsed.packet, {
        fonts: systemFonts({ folders: [join(context.directory, 'fonts')] }),
      }),
    };
  }
  if (action === 'packet_rules') {
    const state = context.packetRules.current();
    return {
      rules: state.rules,
      custom: state.custom,
      error: state.error,
      summary: describePacketRules(state.rules),
    };
  }
  if (action === 'export') {
    const approval = context.board.get<Approval>('approval', String(data.approvalId));
    if (approval.cardId !== capability.cardId)
      throw new Error('This run cannot access another application.');
    return {
      directory: await context.exportPacket(approval.id, () => {
        if (
          context.capabilities.get(token) !== capability ||
          context.controllers.get(capability.runId)?.signal.aborted
        )
          throw new Error('Run capability is invalid or expired.');
        if (!requireRole(context, capability.roleId).enabled)
          throw new Error('This role is paused.');
      }),
    };
  }
  throw new Error('This tool is not allowed.');
};
