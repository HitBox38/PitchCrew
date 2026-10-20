import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { qualityAgentInput } from '@pitchcrew/core';
import type { AgentCall } from './client.ts';

export const registerQualityTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_application_quality',
    {
      title: 'Writing guide and career action plans',
      description:
        'Read the shared writing guide. Apply explicit user standing preferences with their current message source; request an isolated Writer correction with an exact user quote, attached draft and writerId. Never rewrite application drafts in ordinary chat. Pipeline reviewers can propose guide changes for user review. Read career plans and exact source requirements with plans_read before refreshing. Plan refresh/progress requires manageCareerPlans and readApplications. Preserve chosen priorities, cite exact requirements, label coverage gaps and use evidence kind until the user confirms a skill gap. Clear user progress statements can update action progress with exact message/quote; completion is not verified Profile evidence. New corrections only; never mine older chats automatically.',
      inputSchema: { input: qualityAgentInput },
    },
    (input) => call('quality', input),
  );
};
