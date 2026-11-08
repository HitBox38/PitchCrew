import {
  isUserControlError,
  userControlPauseLabel,
  type ComputerApproval,
  type Run,
} from '@pitchcrew/core';
import {
  browserActionAsked,
  browserActionDone,
  browserActionParts,
  joinBrowserActionParts,
} from '@pitchcrew/core/browser-action-labels';
import { randomUUID } from 'node:crypto';
import { recordChatActivity } from '../chat-activity.ts';
import type { CrewContext } from '../types.ts';

/**
 * Browser steps in the words of the tray instead of "Performing browser action": "Asked to click
 * “Learn more”", "Clicked “Learn more”", "Read the page". Labels name elements, never typed or
 * chosen values (activity carries no browser inputs).
 */
const browserStep = (
  context: CrewContext,
  action: string,
  data: Record<string, unknown> | undefined,
): { start: string; done: (result: unknown) => string | undefined } | undefined => {
  if (action === 'computer_inspect')
    return { start: 'Reading the page', done: () => 'Read the page' };
  if (action === 'computer_request')
    return {
      start: 'Requesting browser action',
      done: (result) => {
        const approval = (result as { approval?: ComputerApproval } | undefined)?.approval;
        return approval ? browserActionAsked(approval.action, approval.page) : undefined;
      },
    };
  if (action !== 'computer_execute' || typeof data?.approvalId !== 'string') return undefined;
  const approval = context.board
    .list<ComputerApproval>('computer_approval')
    .find((item) => item.id === data.approvalId);
  if (!approval) return undefined;
  const plain = joinBrowserActionParts(
    browserActionParts(approval.action, approval.page, { values: false, path: false }),
  );
  return {
    start: plain,
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
    const id = `tool-${randomUUID()}`;
    recordChatActivity(context, capability.runId, { id, kind: 'tool', label, status: 'running' });
    return (failed: boolean, error?: unknown, result?: unknown) => {
      try {
        // A takeover stops the agent's browser call: it paused for the user, it did not fail.
        const paused = failed && error instanceof Error && isUserControlError(error.message);
        recordChatActivity(context, capability.runId, {
          id,
          kind: 'tool',
          label: paused
            ? userControlPauseLabel
            : ((!failed && step?.done(result)) || label).slice(0, 160),
          status: paused ? 'interrupted' : failed ? 'failed' : 'completed',
        });
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
  computer_wait: 'Waiting for browser content',
  computer_tabs: 'Managing browser tabs',
  computer_request: 'Requesting browser action',
  computer_execute: 'Performing browser action',
  assess_form: 'Assessing application form',
  capture_submission: 'Checking submission confirmation',
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
