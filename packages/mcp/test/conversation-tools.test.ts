import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Conversation } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createDaemon } from '../../orchestrator/src/server.ts';
import { createAgentClient } from '../src/tools/client.ts';
import { registerConversationTools } from '../src/tools/conversations.ts';

// Registered tools -> agent client -> real /api/agent route -> gateway, so body schema stripping shows up.
it('forwards conversation tool arguments through the agent HTTP route', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-mcp-test-'));
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-mcp-test-'))).toBe(true);
  const daemon = await createDaemon({
    dev: true,
    ui: false,
    directory,
    port: 14621,
    seedSkills: false,
  });
  const client = new Client({ name: 'pitchcrew-conversation-test', version: '1.0.0' });
  try {
    await new Promise<void>((done) => daemon.http.listen(14621, '127.0.0.1', done));
    const { service } = daemon;
    const shared = service.createConversation({ title: 'Fixture plan', participants: ['scout'] });
    const ids = ['First', 'Second', 'Third'].map(
      (text) => service.addMessage(shared.id, 'user', 'scout', text, null, null).id,
    );
    const other = service.createConversation({ title: 'Writer only', participants: ['writer'] });
    service.board.record(
      'run',
      {
        id: 'reader-fixture',
        cardId: null,
        roleId: 'scout',
        runtime: 'demo',
        mode: 'chat',
        status: 'running',
        message: 'Fixture capability',
        startedAt: '',
        finishedAt: null,
      },
      'scout',
      'Fixture run',
    );
    service.controllers.set('reader-fixture', new AbortController());
    service.capabilities.set('reader-token', {
      runId: 'reader-fixture',
      roleId: 'scout',
      cardId: null,
    });
    const server = new McpServer({ name: 'pitchcrew-fixture', version: '1.0.0' });
    registerConversationTools(server, createAgentClient(daemon.url, 'reader-token'));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    await client.connect(clientSide);
    const read = async (args: Record<string, unknown>) => {
      const result = await client.callTool({
        name: 'pitchcrew_read_conversation',
        arguments: args,
      });
      return result as {
        isError?: boolean;
        structuredContent?: { messages: { id: string }[]; beforeId: string | null };
        content: { text: string }[];
      };
    };

    const latest = await read({ conversationId: shared.id, limit: 2 });
    expect(latest.isError).toBeFalsy();
    expect(latest.structuredContent?.messages.map((item) => item.id)).toEqual(ids.slice(1));
    expect(latest.structuredContent?.beforeId).toBe(ids[1]);
    const older = await read({ conversationId: shared.id, beforeId: ids[1], limit: 2 });
    expect(older.structuredContent).toMatchObject({ messages: [{ id: ids[0] }], beforeId: null });

    expect((await read({})).isError).toBe(true);
    const cursor = await read({ conversationId: shared.id, beforeId: 'missing-message' });
    expect(cursor).toMatchObject({
      isError: true,
      content: [{ text: 'Message cursor not found.' }],
    });
    const denied = await read({ conversationId: other.id });
    expect(denied).toMatchObject({
      isError: true,
      content: [{ text: 'This role cannot access the conversation.' }],
    });

    const group = await client.callTool({
      name: 'pitchcrew_create_group',
      arguments: { title: 'Fixture group', participants: ['writer'] },
    });
    const created = (group.structuredContent as { conversation: Conversation }).conversation;
    expect(created).toMatchObject({ title: 'Fixture group', leadId: 'scout' });
    expect(created.participants).toEqual(['scout', 'writer']);
  } finally {
    await client.close();
    daemon.service.controllers.delete('reader-fixture');
    await daemon.close();
    await rm(directory, { recursive: true, force: true });
  }
});
