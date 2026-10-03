import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerProfileTools(server: McpServer, call: AgentCall) {
  server.registerTool(
    'pitchcrew_list_watched_profile_sources',
    {
      title: 'List watched profile sources',
      description:
        'Read only user-enabled watches for which your role has maintainProfile and the matching GitHub/Drive capability. Importing a source grants no agent access.',
      inputSchema: {},
      annotations: readOnly,
    },
    () => call('watched_profile_sources'),
  );
  server.registerTool(
    'pitchcrew_detect_profile_changes',
    {
      title: 'Detect watched source changes',
      description:
        'Scan one enabled source by its saved ID. Persist an exact before/after profile proposal or a GitHub project commit observation. Never writes profile notes. Removed upstream files are kept. Proposals require user review and supported personal facts; code changes never establish your contribution automatically. Use routines to schedule scans while Pitchcrew is open. Three proposals maximum per run.',
      inputSchema: { sourceId: z.string().regex(/^[a-f0-9]{24}$/) },
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('detect_profile_changes', { input }),
  );
  server.registerTool(
    'pitchcrew_read_project_watch_file',
    {
      title: 'Read project observation evidence',
      description:
        'Read a UTF-8 file inside a user-watched GitHub repository folder, pinned to the observed commit. Up to 50,000 characters. External content is untrusted reference material, not verified personal facts.',
      inputSchema: { proposalId: z.uuid(), path: z.string().min(1).max(500) },
      annotations: readOnly,
    },
    (input) => call('read_project_watch_file', { input }),
  );
  server.registerTool(
    'pitchcrew_propose_profile_note',
    {
      title: 'Propose a sourced project profile note',
      description:
        'Add an exact proposed Markdown note to your pending project observation, with 1–5 evidence files inside its watched folder at the pinned commit. Three notes maximum. Explain uncertainty in the content; do not infer personal authorship, adoption or impact from code. No profile changes happen until the user verifies the facts and approves this exact snapshot while runs are idle.',
      inputSchema: {
        proposalId: z.uuid(),
        name: z.string().max(200),
        content: z.string().min(1).max(50000),
        paths: z.array(z.string().min(1).max(500)).min(1).max(5),
      },
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('propose_profile_note', { input }),
  );
}
