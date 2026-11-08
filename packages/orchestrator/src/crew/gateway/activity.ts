import {
  isUserControlError,
  userControlPauseLabel,
  type ComputerApproval,
  type Run,
} from '@pitchcrew/core';
import {
  browserActionAsked,
  browserActionDone,
  browserActionPublic,
  browserStepLabels,
} from '@pitchcrew/core/browser-action-labels';
import { randomUUID } from 'node:crypto';
import { recordChatActivity } from '../chat-activity.ts';
import type { CrewContext } from '../types.ts';

/**
 * Browser steps in the words of the tray instead of "Performing browser action": "Asked to click
 * “Learn more”", "Clicked “Learn more”", "Read the page". Labels name elements, never typed or
 * chosen values (activity carries no browser inputs).
 */
/**
 * Each browser action is one row: the row that asked for an approval becomes the row that carries
 * it out ("Asked to click …" → "Click …" → "Clicked …"), keyed by approval in memory only.
 */
const actionRows = new WeakMap<CrewContext, Map<string, string>>();
const rowsFor = (context: CrewContext) => {
  let rows = actionRows.get(context);
  if (!rows) actionRows.set(context, (rows = new Map()));
  return rows;
};

const browserStep = (
  context: CrewContext,
  action: string,
  data: Record<string, unknown> | undefined,
):
  | {
      start: string;
      done: (result: unknown) => string | undefined;
      /** An existing row this call continues. */
      row?: string;
      /** Called with the result and row once the call succeeds. */
      settled?: (result: unknown, row: string) => void;
    }
  | undefined => {
  if (action === 'computer_inspect')
    return { start: browserStepLabels.inspect, done: () => browserStepLabels.inspected };
  if (action === 'computer_request')
    return {
      start: browserStepLabels.request,
      done: (result) => {
        const approval = (result as { approval?: ComputerApproval } | undefined)?.approval;
        return approval ? browserActionAsked(approval.action, approval.page) : undefined;
      },
      settled: (result, row) => {
        const approval = (result as { approval?: ComputerApproval } | undefined)?.approval;
        if (!approval) return;
        const rows = rowsFor(context);
        rows.set(approval.id, row);
        // Requests are decided one at a time; a few stale entries are all that can build up.
        for (const key of [...rows.keys()].slice(0, -50)) rows.delete(key);
      },
    };
  if (action !== 'computer_execute' || typeof data?.approvalId !== 'string') return undefined;
  const approval = context.board
    .list<ComputerApproval>('computer_approval')
    .find((item) => item.id === data.approvalId);
  if (!approval) return undefined;
  const plain = browserActionPublic(approval.action, approval.page);
  return {
    start: plain,
    row: rowsFor(context).get(approval.id),
    settled: (result) => {
      if ((result as { status?: string } | undefined)?.status !== 'pending')
        rowsFor(context).delete(approval.id);
    },
    done: (result) =>
      (result as { status?: string } | undefined)?.status === 'pending'
        ? `Waited for your OK to ${plain.charAt(0).toLowerCase()}${plain.slice(1)}`
        : browserActionDone(approval.action, approval.page),
  };
};

export const observeChatTool = (
  context: CrewContext,
  token: string,
  action: string,
  data?: Record<string, unknown>,
) => {
  try {
    const capability = context.capabilities.get(token);
    // Discovery/bootstrap and non-chat capabilities have no transcript activity.
    if (
      !capability ||
      action.endsWith('_access') ||
      action === 'report_progress' ||
      !context.board
        .list<Run>('run')
        .some((run) => run.id === capability.runId && (run.mode === 'chat' || !!run.deepReviewId))
    )
      return () => {};
    const step = browserStep(context, action, data);
    const label = step?.start ?? labels[action] ?? 'Using a crew tool';
    const id = step?.row ?? `tool-${randomUUID()}`;
    recordChatActivity(context, capability.runId, { id, kind: 'tool', label, status: 'running' });
    return (failed: boolean, error?: unknown, result?: unknown) => {
      try {
        // A takeover stops the agent's browser call, or the gateway waited out the user's control
        // without acting ({ status: 'manual' }): it paused for the user, it neither failed nor ran.
        const paused =
          (failed && error instanceof Error && isUserControlError(error.message)) ||
          (!failed && (result as { status?: string } | undefined)?.status === 'manual');
        recordChatActivity(context, capability.runId, {
          id,
          kind: 'tool',
          label: paused
            ? userControlPauseLabel
            : ((!failed && step?.done(result)) || label).slice(0, 160),
          status: paused ? 'interrupted' : failed ? 'failed' : 'completed',
        });
        if (!failed && !paused) step?.settled?.(result, id);
      } catch {
        /* Activity must never change a tool's result or error. */
      }
    };
  } catch {
    return () => {};
  }
};

const labels: Record<string, string> = {
  quality: 'Updating writing preferences and career plans',
  check_linkedin_draft: 'Checking LinkedIn draft lengths',
  start_deep_review: 'Starting deep resume review',
  start_review_subagent: 'Starting targeted second opinion',
  review_subagents: 'Reading second opinions',
  extend_review_deadline: 'Extending shared review deadline',
  request_review_time: 'Requesting more review time',
  profile: 'Reading profile',
  card: 'Reading job details',
  history: 'Reading application history',
  messages: 'Reading conversations',
  conversation_messages: 'Reading conversation',
  roles: 'Checking crew',
  chat_attachment: 'Reading attachment',
  recall_memory: 'Recalling saved context',
  read_skill: 'Reading skill instructions',
  save_memory: 'Saving a memory',
  scan_job_sources: 'Scanning saved job boards',
  import_job_link: 'Reading job link and saving job details',
  job_sources: 'Reading job sources',
  computer_inspect: 'Inspecting browser',
  computer_wait: browserStepLabels.wait,
  computer_tabs: browserStepLabels.tabs,
  computer_request: browserStepLabels.request,
  computer_execute: 'Performing browser action',
  assess_form: browserStepLabels.assess,
  capture_submission: browserStepLabels.capture,
  connector: 'Reading connected sources',
  lint: 'Checking packet',
  packet_rules: 'Reading packet rules',
  export: 'Exporting approved packet',
  workflow: 'Updating application workflow',
  update_job: 'Correcting saved job details',
  message: 'Messaging a crew member',
  invoke: 'Requesting crew work',
  delegate_round: 'Delegating subtasks to the crew',
  ask_user: 'Asking you a question',
  notify_user: 'Posting an update',
  report_technical_problem: 'Reporting a technical problem',
  propose: 'Proposing agent changes',
  propose_skill: 'Suggesting a skill',
  read_pipeline: 'Reviewing applications',
  save_pipeline_review: 'Saving pipeline review',
  applications: 'Reading applications',
  tracking_scan: 'Checking tracked applications',
  application_insights: 'Reading application insights',
  routines: 'Reading routines',
};
