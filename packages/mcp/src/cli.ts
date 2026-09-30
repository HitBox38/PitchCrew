import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { packetSchema } from '@pitchcrew/core';
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
await server.connect(new StdioServerTransport());
