import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { userQuestionInput } from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerApplicationInputTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_ask_user',
    {
      description:
        'Ask for a missing application answer. Use applicationRequirementId for a confirmed personal requirement, or use the exact unique assessed form field label as question. Put explanations in reason, not question; unbound questions are rejected. Managed deep-review clarifications are scoped to that review. Asking ends this turn; the user answer resumes only your isolated workflow.',
      inputSchema: userQuestionInput,
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('ask_user', { input }),
  );
  server.registerTool(
    'pitchcrew_notify_user',
    {
      description: 'Save an application progress message for the user. This grants no approval.',
      inputSchema: {
        kind: z.enum(['message', 'attention']),
        content: z.string().trim().min(1).max(8000),
      },
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('notify_user', input),
  );
};
