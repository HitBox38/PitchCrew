import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  applicationQuery,
  insightsQuery,
  submissionAttemptQuery,
  trackingReconciliation,
} from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerTrackingTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_search_applications',
    {
      title: 'Search tracked applications',
      description:
        'Requires readApplications. Bounded cross-application search with saved tracking evidence and pagination. Search company AND title, job URL or identifier to check duplicates, then use pitchcrew_read_submission_attempts for durable attempt history on a matched card. No direct database access.',
      inputSchema: { input: applicationQuery },
      annotations: readOnly,
    },
    (input) => call('applications', input),
  );
  server.registerTool(
    'pitchcrew_read_submission_attempts',
    {
      title: 'Read submission attempt history',
      description:
        'Requires readApplications and an active run. Read durable submission attempt metadata for one card, newest first (20 by default, maximum 50; use nextOffset). Omit cardId for the attached card; an attached run cannot read another card. Standalone chats must supply a cardId from application search. Returns attempt/run/role IDs, uncertain/confirmed/not_submitted status, creation/resolution times, and confirmation presence or external verification time. hasUncertainAttempts covers the entire card history, including later pages. Browser evidence, entered values, URLs, packet digests and approval payloads are excluded. Captured confirmation alone is not user verification. This read never resolves uncertainty or authorizes interactions, retries, export or submission. Never retry an uncertain submission; ask the user to verify its outcome.',
      inputSchema: { input: submissionAttemptQuery.optional() },
      annotations: readOnly,
    },
    (input) => call('submission_attempts', input),
  );
  server.registerTool(
    'pitchcrew_application_insights',
    {
      title: 'Read application insights',
      description:
        "Requires readApplications or reviewPipeline. Read-only learning signals from past applications: outcome counts (interviewing/offer positive; rejected/no response negative; withdrawn neutral; others pending), a tag scoreboard (count, positive share of decided, average user weight -2..+2, up to 5 sample companies), weight distribution and recent user lessons grouped by outcome. Optional tag and ISO date filters on the application date. Bounded to 50 tags, 10 lessons per outcome, 500 characters per lesson and 64 KB; truncated is true when lists were shortened. Weights and lessons are the user's judgments, not proof of cause. Agents cannot change them.",
      inputSchema: { input: insightsQuery.optional() },
      annotations: readOnly,
    },
    (input) => call('application_insights', input),
  );
  server.registerTool(
    'pitchcrew_scan_application_mail',
    {
      title: 'Scan Gmail for application updates',
      description:
        'Requires readApplications, trackApplications and Gmail. Persist a bounded page (20 IDs) of a Gmail query. Read/reconcile every pending ID before requesting the next page. Resumes interrupted pages; repeated completed scans deduplicate saved evidence. Use existing routines for periodic scans while daemon is open. No mailbox changes.',
      inputSchema: { input: z.object({ query: z.string().trim().min(1).max(1000) }) },
      annotations: { ...readOnly, readOnlyHint: false },
    },
    (input) => call('tracking_scan', input),
  );
  server.registerTool(
    'pitchcrew_reconcile_application_mail',
    {
      title: 'Reconcile a Gmail application signal',
      description:
        'Supply an exact quotation from a pending Gmail message, company/title and suggested state. Server fetches and verifies message, account, quote and timestamp. Automatic updates need a unique stable job URL or user-linked Gmail thread and recognized status plus valid newer transition. Ambiguous/unsupported signals save user-review proposals. Optional ignoreReason records an unrelated message without updating applications. Idempotent by mailbox/message ID; proposals never submit or export anything.',
      inputSchema: { input: trackingReconciliation },
      annotations: { ...readOnly, readOnlyHint: false },
    },
    (input) => call('tracking_reconcile', input),
  );
};
