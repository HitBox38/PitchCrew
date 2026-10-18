import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { linkedInDraftInput } from '@pitchcrew/core';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerLinkedInTools(server: McpServer, call: AgentCall) {
  server.registerTool(
    'pitchcrew_check_linkedin_draft',
    {
      description:
        'Measure supplied LinkedIn draft fields locally without editing or publishing them. Returns UTF-16 lengths, code-point counts, reported limits and warnings. Supply the complete proposed skills list for a profile-wide skills count. Does not verify facts; the live LinkedIn editor remains authoritative.',
      inputSchema: { input: linkedInDraftInput },
      annotations: readOnly,
    },
    (input) => call('check_linkedin_draft', input),
  );
}
