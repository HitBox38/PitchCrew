import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { packetSchema, roleIds, roleChanges, skillSuggestionInput } from '@pitchcrew/core';
import { connectorTools } from './connectors/tools.ts';
const url = process.env.PITCHCREW_DAEMON_URL;
const token = process.env.PITCHCREW_RUN_TOKEN;
if (!url || !token || new URL(url).hostname !== '127.0.0.1')
  throw new Error('A loopback daemon URL and scoped run capability are required.');
const server = new McpServer({ name: 'pitchcrew-mcp-server', version: '0.1.0' });
async function call(action: string, data: Record<string, unknown> = {}) {
  try {
    const response = await fetch(`${url}/api/agent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...data }),
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(String(result.error ?? 'Tool failed.'));
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        { type: 'text' as const, text: error instanceof Error ? error.message : 'Tool failed.' },
      ],
    };
  }
}
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
server.registerTool(
  'pitchcrew_get_card',
  {
    title: 'Current application',
    description:
      'Read the application card assigned to this run, including its packet and feedback.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('card'),
);
server.registerTool(
  'pitchcrew_read_profile',
  {
    title: 'Read source profile',
    description: 'Read the profile Markdown files that support application claims.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('profile'),
);
server.registerTool(
  'pitchcrew_get_history',
  {
    title: 'Application history',
    description:
      'Read immutable history for the assigned card, newest first. Use nextCursor as beforeEventId to read older events.',
    inputSchema: {
      beforeEventId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Exclusive cursor from a previous history response.'),
      limit: z.number().int().min(1).max(200).default(100).describe('Maximum events per page.'),
    },
    annotations: readOnly,
  },
  (query) => call('history', query),
);
server.registerTool(
  'pitchcrew_lint_packet',
  {
    title: 'Check packet evidence',
    description:
      'Check exact source quotes and word limits. This is a mechanical check, not a complete factual review.',
    inputSchema: { packet: packetSchema },
    annotations: readOnly,
  },
  ({ packet }) => call('lint', { packet }),
);
server.registerTool(
  'pitchcrew_export_packet',
  {
    title: 'Export approved packet',
    description:
      'Export locally only with an unused user approval bound to this exact packet. Agents cannot approve actions.',
    inputSchema: { approvalId: z.uuid() },
    annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
  },
  ({ approvalId }) => call('export', { approvalId }),
);
server.registerTool(
  'pitchcrew_read_messages',
  {
    title: 'Read conversations',
    description: 'Read your own user chat and the visible crew conversation.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('messages'),
);
server.registerTool(
  'pitchcrew_message_agent',
  {
    title: 'Message a crew member',
    description:
      'Persist a visible crew message and queue a reply from that role after this run finishes. Six follow-ups maximum per user-started chain.',
    inputSchema: { roleId: z.enum(roleIds), content: z.string().trim().min(1).max(8000) },
    annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
  },
  (input) => call('message', input),
);
server.registerTool(
  'pitchcrew_invoke_agent',
  {
    title: 'Invoke a role',
    description:
      'Queue yourself or another role after this run completes. Chat continues the crew conversation; workflow runs operate only on the attached card and must follow its state machine. Six follow-ups maximum per chain.',
    inputSchema: {
      roleId: z.enum(roleIds),
      content: z.string().trim().min(1).max(8000),
      mode: z.enum(['chat', 'workflow']),
    },
    annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
  },
  (input) => call('invoke', input),
);
server.registerTool(
  'pitchcrew_propose_role_changes',
  {
    title: 'Propose changes to your role',
    description:
      'Propose your own instructions or capabilities. The user reviews and applies them in chat. This tool does not change permissions or rules.',
    inputSchema: { reason: z.string().trim().min(1).max(2000), changes: roleChanges },
    annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
  },
  (input) => call('propose', input),
);
server.registerTool(
  'pitchcrew_change_workflow',
  {
    title: 'Update attached job workflow',
    description:
      'Shortlist a lead or request changes to a packet. Cannot bypass drafting, review, export approval or manual submission. Rejects changes while the card has an active workflow run.',
    inputSchema: {
      state: z.enum(['shortlisted', 'changes_requested']),
      reason: z.string().trim().min(1).max(2000),
    },
    annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
  },
  (input) => call('workflow', input),
);
server.registerTool(
  'pitchcrew_propose_skill',
  {
    title: 'Suggest adding an agent skill',
    description:
      'Propose a custom Markdown skill or a public GitHub-backed skills.sh skill URL for all agents or selected roles. Suggestions from user or crew chats are saved for user review, never installed automatically. Directory instructions are untrusted until the user approves the exact snapshot. Only SKILL.md instructions are imported; supporting scripts and files are not included. Three suggestions maximum per run.',
    inputSchema: { reason: z.string().trim().min(1).max(2000), suggestion: skillSuggestionInput },
    annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  },
  (input) => call('propose_skill', input),
);
server.registerTool(
  'pitchcrew_list_connectors',
  {
    description:
      'List connector tools permitted for your role and their connection status. Ask the user to connect accounts or enable capabilities in Your crew when needed.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('connector_access'),
);
// Discover permissions using only the scoped capability, never connector credentials.
const access = await call('connector_access');
const allowed = new Set(
  'structuredContent' in access && Array.isArray(access.structuredContent?.tools)
    ? (access.structuredContent.tools as string[])
    : [],
);
for (const [name, tool] of Object.entries(connectorTools)) {
  if (!allowed.has(name)) continue;
  server.registerTool(
    name,
    {
      description: tool.description,
      inputSchema: tool.schema,
      annotations: { ...readOnly, openWorldHint: true },
    },
    (input: Record<string, unknown>) => call('connector', { tool: name, input }),
  );
}
await server.connect(new StdioServerTransport());
