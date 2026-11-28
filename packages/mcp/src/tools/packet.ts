import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  historyReadQuery,
  packetSchema,
  readFieldQuery,
  resumeReviewPacketSchema,
} from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerPacketTools = (
  server: McpServer,
  call: AgentCall,
  isolated = false,
  resumeOnly = false,
) => {
  server.registerTool(
    'pitchcrew_get_card',
    {
      title: 'Current application',
      description:
        'Read the assigned application, packet and feedback. A large card lists omittedFields. Request a field by name or dotted path (such as packet.resume or applicationContext.requirements.0). For a long value, append text pages using nextCursor as cursor with the same field.',
      inputSchema: readFieldQuery.shape,
      annotations: readOnly,
    },
    (input) => call('card', { input }),
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
  if (!isolated)
    server.registerTool(
      'pitchcrew_get_history',
      {
        title: 'Application history',
        description:
          'Read compact immutable events for the attached card, newest first. Pass nextCursor as beforeEventId for older events. To inspect a snapshot, pass eventId and a field such as data.feedback, data.packet.resume or message. For long values, continue with the same eventId and field and pass nextCursor as cursor.',
        inputSchema: historyReadQuery.shape,
        annotations: readOnly,
      },
      (input) => call('history', { input }),
    );
  server.registerTool(
    'pitchcrew_lint_packet',
    {
      title: 'Check packet evidence',
      description:
        "Check exact source quotes and the user's packet rules. problems lists blocking errors; warnings are advisory. findings give each rule id, severity and document. layout reports formatted PDF page counts and warnings, including the one-page resume target. documents reports bounded text extraction, content retention and advisory geometry checks, with per-file findings and DOCX fallback when PDF is unavailable. This is a mechanical check, not a complete factual review." +
        (resumeOnly
          ? ' This specialist run checks only the supplied resume and its claims. Keep hidden coverLetter, formAnswers and note empty; claims may be empty. A resume-scoped result does not validate the full packet.'
          : ''),
      inputSchema: { packet: resumeOnly ? resumeReviewPacketSchema : packetSchema },
      annotations: readOnly,
    },
    ({ packet }) => call('lint', { packet }),
  );
  server.registerTool(
    'pitchcrew_get_packet_rules',
    {
      title: 'Read packet rules',
      description:
        "Read the user's packet house rules and a short summary. Only the user can change them in Settings.",
      inputSchema: {},
      annotations: readOnly,
    },
    () => call('packet_rules'),
  );
  if (!isolated)
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
};
