import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { packetSchema } from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerPacketTools(server: McpServer, call: AgentCall) {
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
}
