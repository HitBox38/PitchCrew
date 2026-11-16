import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerProfileTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_list_profile_edit_sources',
    {
      title: 'Read profile edit sources and baselines',
      description:
        'Requires editProfile and a direct user chat request. Read local note SHA-256 baselines and connected profile import mappings. Use pitchcrew_read_profile for content. Project watches are excluded. No account credentials are returned.',
      inputSchema: {},
      annotations: readOnly,
    },
    () => call('profile_edit_sources'),
  );
  server.registerTool(
    'pitchcrew_update_profile',
    {
      title: 'Update profile and its connected GitHub source',
      description:
        'Only carry out profile changes the user directly requested in this chat. Requires editProfile. Save creates/edits a Markdown note; delete moves it to recoverable trash. Supply the current baseline from pitchcrew_list_profile_edit_sources (null for a new note). Attached GitHub notes sync to their saved path with the connected source account; a new note can choose sourceId/path, otherwise the sole GitHub import is used. Multiple imports require a choice. Sync checks the remote blob revision. Local changes are kept if sync fails: report unsynced and inspect GitHub before any retry. Scheduled/crew turns must use proposals. Never infer personal facts from code.',
      inputSchema: {
        action: z.enum(['save', 'delete']),
        name: z.string().min(1).max(100),
        baseline: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .nullable(),
        content: z.string().max(50000).optional(),
        sourceId: z
          .string()
          .regex(/^[a-f0-9]{24}$/)
          .optional(),
        path: z.string().min(1).max(500).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    (input) => call('update_profile', { input }),
  );
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
};
