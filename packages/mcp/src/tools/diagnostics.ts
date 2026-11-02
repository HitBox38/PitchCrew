import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { agentProblemInputShape } from '@pitchcrew/core/telemetry-errors';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerDiagnosticTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_report_technical_problem',
    {
      title: 'Report a Pitchcrew technical problem',
      description:
        'Report a Pitchcrew bug or missing MCP capability that blocks or adds avoidable manual work to an authorized task. Include area, kind (bug or missing_capability), summary, expected and actual behavior, plus minimal steps, workaround and an existing related tool name when known. Describe product behavior generically: never include names, company/job details, messages, documents, URLs, paths, IDs, credentials, raw errors, logs or tool input/output. Paraphrase the failure; use placeholders in steps. Report each distinct problem once before asking for help or ending the turn; do not investigate just to file a report. Expected approval waits, missing user answers, deliberately disabled permissions and candidate/application limitations are not bugs or missing capabilities. Reports reach consent-gated PostHog diagnostics on a best-effort basis through an opted-in configured renderer; success is local handling, not confirmed upload. Reporting does not notify the user, retry work or grant permissions.',
      inputSchema: agentProblemInputShape,
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: true },
    },
    (input) => call('report_technical_problem', { input }),
  );
};
