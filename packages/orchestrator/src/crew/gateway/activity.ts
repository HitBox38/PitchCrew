import type { Run } from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { recordChatActivity } from '../chat-activity.ts';
import type { CrewContext } from '../types.ts';

export const observeChatTool = (context: CrewContext, token: string, action: string) => {
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
    const label = labels[action] ?? 'Using a crew tool';
    const id = `tool-${randomUUID()}`;
    recordChatActivity(context, capability.runId, { id, kind: 'tool', label, status: 'running' });
    return (failed: boolean) => {
      try {
        recordChatActivity(context, capability.runId, {
          id,
          kind: 'tool',
          label,
          status: failed ? 'failed' : 'completed',
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
