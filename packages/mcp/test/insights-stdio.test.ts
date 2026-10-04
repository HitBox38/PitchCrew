import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { defaultCapabilities, type Card, type Role } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { setup, cleanup } from '../../orchestrator/test/helpers/daemon.ts';

it('serves read-only application insights through real stdio with capability gating', async () => {
  const { daemon, request } = await setup(15445);
  const client = new Client({ name: 'insights-contract-test', version: '1.0.0' });
  try {
    const role = daemon.service.board.get<Role>('role', 'writer');
    daemon.service.capabilities.set('insights-token', {
      runId: 'insights-fixture',
      roleId: 'writer',
      cardId: null,
    });
    daemon.service.controllers.set('insights-fixture', new AbortController());
    const card = (
      await request<Card>('/cards', 'POST', {
        company: 'Oakline Studio',
        title: 'Product Designer',
        tags: ['Design systems'],
      })
    ).result;
    await request(`/cards/${card.id}/weight`, 'PUT', { weight: 2 });
    await request(`/cards/${card.id}/lessons`, 'POST', { text: 'Portfolio case study landed.' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          '--import',
          import.meta.resolve('tsx'),
          fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
        ],
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              (entry): entry is [string, string] => entry[1] !== undefined,
            ),
          ),
          PITCHCREW_DAEMON_URL: daemon.url,
          PITCHCREW_RUN_TOKEN: 'insights-token',
        },
        stderr: 'pipe',
      }),
    );
    const { tools } = await client.listTools();
    const tool = tools.find((item) => item.name === 'pitchcrew_application_insights');
    expect(tool?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    // No tool lets an agent set weights, lessons, tags or no-response status.
    expect(
      tools.map((item) => item.name).filter((name) => /weight|lesson|tag|stale|ghost/.test(name)),
    ).toEqual([]);
    const denied = await client.callTool({
      name: 'pitchcrew_application_insights',
      arguments: { input: {} },
    });
    expect(denied.isError).toBe(true);
    daemon.service.board.record(
      'role',
      { ...role, capabilities: { ...defaultCapabilities, readApplications: true } },
      'user',
      'Enable fixture application reads',
    );
    const result = await client.callTool({
      name: 'pitchcrew_application_insights',
      arguments: { input: { tag: 'design systems', sort: 'weight' } },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      total: 1,
      tags: [{ tag: 'Design systems', averageWeight: 2, companies: ['Oakline Studio'] }],
      lessons: { pending: [expect.objectContaining({ text: 'Portfolio case study landed.' })] },
      limits: { maximumBytes: 64000 },
    });
    const invalid = await client.callTool({
      name: 'pitchcrew_application_insights',
      arguments: { input: { lessonLimit: 11 } },
    });
    expect(invalid.isError).toBe(true);
    expect(daemon.service.board.get<Card>('card', card.id).weight).toBe(2);
  } finally {
    daemon.service.controllers.delete('insights-fixture');
    daemon.service.capabilities.delete('insights-token');
    await client.close();
    await cleanup();
  }
});
