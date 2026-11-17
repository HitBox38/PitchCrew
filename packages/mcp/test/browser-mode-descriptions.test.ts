import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserModeLabels, browserModeOrder } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createExternalMcpServer } from '../src/external/server.ts';
import { registerComputerTools } from '../src/tools/computer.ts';

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

const connect = async (server: McpServer) => {
  const client = new Client({ name: 'pitchcrew-description-test', version: '1.0.0' });
  clients.push(client);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
};

it('tells agents what each browser mode approves and what asks in every mode', async () => {
  const server = new McpServer({ name: 'fixture', version: '1.0.0' });
  await registerComputerTools(
    server,
    vi.fn().mockResolvedValue({ content: [], structuredContent: { enabled: true } }),
  );
  const { tools } = await (await connect(server)).listTools();
  const description = (name: string) => tools.find((tool) => tool.name === name)?.description;
  const request = description('pitchcrew_computer_request') ?? '';
  for (const mode of browserModeOrder)
    expect(request).toMatch(new RegExp(`\\b${browserModeLabels[mode]}\\b`));
  expect(request).toContain(
    'In every mode the server asks the user before an action marked purpose submission',
  );
  expect(request).toContain('Recognizing unmarked sending is best effort');
  expect(request).toContain('never send, post or submit anything the user has not asked for');
  expect(request).toContain('mark the final submission click/Enter with purpose submission');
  expect(request).toContain('never infer approval from the mode');
  expect(request).not.toMatch(/clicks, keys, dialogs and submissions still ask/i);
  expect(description('pitchcrew_computer_execute')).toContain(
    'An action the server approved on its own runs at once',
  );
});

it('tells external apps that the crew runs they start browse in Supervised mode', async () => {
  const client = await connect(createExternalMcpServer(vi.fn(), true));
  expect(client.getInstructions()).toContain('browse in Supervised mode');
  const { tools } = await client.listTools();
  expect(tools.find((tool) => tool.name === 'pitchcrew_send_message')?.description).toContain(
    'runs started this way browse in Supervised mode',
  );
});
