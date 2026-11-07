import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export const registerSkillTools = (server: McpServer, call: AgentCall) => {
  server.registerTool(
    'pitchcrew_read_skill',
    {
      title: 'Read assigned skill instructions',
      description:
        'Read the complete instructions of one skill assigned to this run by its catalog ID. Returns the exact saved version captured when this run started, including after later edits or deletion. Read relevant skills before following their guidance. This does not install or update skills, grant capabilities or approve actions.',
      inputSchema: z.object({ skillId: z.uuid() }).strict(),
      annotations: readOnly,
    },
    (input) => call('read_skill', { input }),
  );
};
