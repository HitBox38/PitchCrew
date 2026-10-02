import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { roleChanges, roleIds, skillSuggestionInput } from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerCrewTools(server: McpServer, call: AgentCall) {
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
}
