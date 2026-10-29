import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { agentProblemAreas } from '@pitchcrew/core/telemetry-errors';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerDiagnosticTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_report_technical_problem',
    {
      title: 'Report a Pitchcrew technical problem',
      description:
        'Report a technical Pitchcrew failure that blocks your work as a sanitized PostHog error through the existing consent-gated diagnostics pipeline. Choose only the affected area; never send error text, tool input/output, URLs or user content. Report once per area per run, before asking for help or ending the turn. Expected approval waits, user questions, disabled permissions and candidate/application limitations are not technical failures. Delivery is best effort and requires an opted-in, configured renderer; success does not confirm upload. This does not notify the user, retry work or grant permissions.',
      inputSchema: { area: z.enum(agentProblemAreas) },
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: true },
    },
    (input) => call('report_technical_problem', { input }),
  );
};
