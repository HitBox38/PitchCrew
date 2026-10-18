import { registerDeepReviewTools } from './tools/deep-reviews.ts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createAgentClient } from './tools/client.ts';
import { registerComputerTools } from './tools/computer.ts';
import { registerConnectorsTools } from './tools/connectors.ts';
import { registerCrewTools } from './tools/crew.ts';
import { registerPacketTools } from './tools/packet.ts';
import { registerProfileTools } from './tools/profile.ts';
import { registerPipelineTools } from './tools/pipeline.ts';
import { registerRoutineTools } from './tools/routines.ts';
import { registerTrackingTools } from './tools/tracking.ts';
import { registerJobSourceTools } from './tools/job-sources.ts';
import { registerApplicationInputTools } from './tools/application-input.ts';
import { registerLinkedInTools } from './tools/linkedin.ts';

const url = process.env.PITCHCREW_DAEMON_URL;
const token = process.env.PITCHCREW_RUN_TOKEN;
if (!url || !token || new URL(url).hostname !== '127.0.0.1')
  throw new Error('A loopback daemon URL and scoped run capability are required.');
const server = new McpServer({ name: 'pitchcrew-mcp-server', version: '0.1.0' });
const call = createAgentClient(url, token);

const execution = await call('execution_access');
if (execution.isError || !execution.structuredContent)
  throw new Error('Cannot verify the scoped execution purpose.');
const purpose = execution.structuredContent?.purpose;
const isolated = ['application-draft', 'application-review', 'fit'].includes(String(purpose));
if (purpose === 'source-extraction') {
  // Required MCP clients discover tools even for runs with no callable actions.
  // McpServer only installs discovery when a tool is registered.
  server.server.registerCapabilities({ tools: {} });
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [] }));
} else {
  registerPacketTools(server, call, isolated);

  if (isolated) {
    if (!['subagent', 'budget'].includes(String(execution.structuredContent.reviewMode)))
      registerApplicationInputTools(server, call);
    if (execution.structuredContent.reviewMode)
      registerDeepReviewTools(
        server,
        call,
        execution.structuredContent.reviewMode as 'parent' | 'subagent' | 'writer' | 'budget',
      );
  } else {
    registerCrewTools(server, call);
    registerLinkedInTools(server, call);
    registerDeepReviewTools(server, call);
    registerRoutineTools(server, call);
    registerProfileTools(server, call);
    registerTrackingTools(server, call);
    await registerPipelineTools(server, call);
    await registerJobSourceTools(server, call);

    // Browser tools are exposed only to enabled roles; the daemon rechecks every call.
    await registerComputerTools(server, call);

    // Discover permissions using only the scoped capability, never connector credentials.
    await registerConnectorsTools(server, call);
  }
}

await server.connect(new StdioServerTransport());
