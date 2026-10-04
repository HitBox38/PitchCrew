import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { applicationQuery, insightsQuery, trackingReconciliation } from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerTrackingTools(server: McpServer, call: AgentCall) {
  server.registerTool(
    'pitchcrew_search_applications',
    {
      title: 'Search tracked applications',
      description:
        'Requires readApplications. Bounded cross-application search with saved tracking evidence and pagination. Search company AND title, job URL or identifier to check duplicates. No direct database access.',
      inputSchema: { input: applicationQuery },
      annotations: readOnly,
    },
    (input) => call('applications', input),
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
}
