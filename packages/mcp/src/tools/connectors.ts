import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { connectorTools } from '../connectors/tools.ts';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export async function registerConnectorsTools(server: McpServer, call: AgentCall) {
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
}
