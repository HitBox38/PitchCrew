import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applicationQuery, bulkDeleteJobsInput, bulkMoveJobsInput, states } from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerJobTools(server: McpServer, call: AgentCall) {
  server.registerTool(
    'pitchcrew_bulk_move_jobs',
    {
      title: 'Move board jobs in bulk',
      description:
        'Requires manageWorkflow. Move 1–100 unique job cardIds to one valid state from any starting statuses, with a shared reason. Each job commits independently with the same checks and approval invalidation as pitchcrew_change_workflow. Returns ordered per-job results and succeeded/failed counts; busy or missing jobs fail without blocking others. Check every result before reporting success. Changes local status only, never exports or submits.',
      inputSchema: bulkMoveJobsInput,
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('bulk_move_jobs', { input }),
  );
  server.registerTool(
    'pitchcrew_bulk_delete_jobs',
    {
      title: 'Delete board jobs in bulk',
      description:
        'Requires manageWorkflow. Delete 1–100 unique job cardIds in any statuses with a shared reason. Each job commits independently with the same history preservation, approval invalidation, queued-work cancellation and routine pausing as pitchcrew_delete_job. Returns ordered per-job results and succeeded/failed counts; busy or missing jobs fail without blocking others. Check every result before reporting success.',
      inputSchema: bulkDeleteJobsInput,
      annotations: {
        ...readOnly,
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    (input) => call('bulk_delete_jobs', { input }),
  );
  server.registerTool(
    'pitchcrew_list_jobs',
    {
      title: 'List board jobs',
      description:
        'Requires manageWorkflow. Find job IDs across the board with bounded filters and nextOffset pagination. Returns company, title, status, location and URL; use readApplications for full application evidence.',
      inputSchema: { input: applicationQuery.optional() },
      annotations: readOnly,
    },
    (input) => call('jobs', input),
  );
  server.registerTool(
    'pitchcrew_change_workflow',
    {
      title: 'Change job status',
      description:
        'Requires manageWorkflow. Move a board job from any status to any status, including terminal statuses. Supply cardId from pitchcrew_list_jobs, or omit it to use the attached job. Records the reason and invalidates unused packet/browser approvals. This changes local board status only; it does not run agents, approve/export packets or submit externally. Wait for active workflow runs to finish.',
      inputSchema: {
        cardId: z.uuid().optional(),
        state: z.enum(states),
        reason: z.string().trim().min(1).max(2000),
      },
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('workflow', input),
  );
  server.registerTool(
    'pitchcrew_delete_job',
    {
      title: 'Delete a board job',
      description:
        'Requires manageWorkflow. Delete a board job in any status. Supply cardId from pitchcrew_list_jobs, or omit it to use the attached job. Removes the job from the board while retaining event history, invalidates unused approvals, cancels queued follow-ups and pauses attached routines. Wait for active workflow runs to finish.',
      inputSchema: {
        cardId: z.uuid().optional(),
        reason: z.string().trim().min(1).max(2000),
      },
      annotations: {
        ...readOnly,
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    (input) => call('delete_job', input),
  );
}
