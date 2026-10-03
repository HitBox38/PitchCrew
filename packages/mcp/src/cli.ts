import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createAgentClient } from './tools/client.ts';
import { registerComputerTools } from './tools/computer.ts';
import { registerConnectorsTools } from './tools/connectors.ts';
import { registerCrewTools } from './tools/crew.ts';
import { registerPacketTools } from './tools/packet.ts';
import { registerRoutineTools } from './tools/routines.ts';
import { registerTrackingTools } from './tools/tracking.ts';

const url = process.env.PITCHCREW_DAEMON_URL;
const token = process.env.PITCHCREW_RUN_TOKEN;
if (!url || !token || new URL(url).hostname !== '127.0.0.1')
  throw new Error('A loopback daemon URL and scoped run capability are required.');
const server = new McpServer({ name: 'pitchcrew-mcp-server', version: '0.1.0' });
const call = createAgentClient(url, token);

registerPacketTools(server, call);

registerCrewTools(server, call);
registerRoutineTools(server, call);
registerTrackingTools(server, call);

// Browser tools are exposed only to enabled roles; the daemon rechecks every call.
await registerComputerTools(server, call);

// Discover permissions using only the scoped capability, never connector credentials.
await registerConnectorsTools(server, call);

await server.connect(new StdioServerTransport());
