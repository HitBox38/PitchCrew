import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Role, Run } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

afterEach(cleanup);

it('checks LinkedIn drafts over actual scoped stdio and rechecks active chat access', async () => {
  const { daemon } = await setup(22589);
  const run: Run = {
    id: 'linkedin-check',
    roleId: 'career-coach',
    threadId: 'career-coach',
    cardId: null,
    runtime: 'demo',
    status: 'running',
    mode: 'chat',
    message: 'Fictional profile draft',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  daemon.service.board.record('run', run, 'user', 'Fixture');
  daemon.service.controllers.set(run.id, new AbortController());
  daemon.service.capabilities.set('linkedin-token', {
    runId: run.id,
    roleId: run.roleId,
    cardId: null,
  });
  const client = new Client({ name: 'linkedin-draft-test', version: '1.0.0' });
  try {
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
          PITCHCREW_RUN_TOKEN: 'linkedin-token',
        },
        stderr: 'pipe',
      }),
    );
    const tool = (await client.listTools()).tools.find(
      (entry) => entry.name === 'pitchcrew_check_linkedin_draft',
    );
    expect(tool?.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    const args = { input: { fields: [{ field: 'headline', text: 'x'.repeat(221) }] } };
    const checked = await client.callTool({ name: tool!.name, arguments: args });
    expect(checked.isError).not.toBe(true);
    expect(checked.structuredContent).toMatchObject({
      fields: [{ count: 221, limit: 220, overBy: 1, evidence: 'reported' }],
    });
    expect(daemon.service.board.list('approval')).toEqual([]);
    expect(
      (
        await client.callTool({
          name: tool!.name,
          arguments: {
            input: { fields: [{ field: 'headline', text: 'x', publish: true }] },
          },
        })
      ).isError,
    ).toBe(true);
    // HTTP callers cannot bypass the same schema validated by MCP.
    await expect(
      daemon.service.agentCall('linkedin-token', 'check_linkedin_draft', {
        input: { skills: [], endpoint: 'https://example.invalid' },
      }),
    ).rejects.toThrow();
    for (const changed of [
      { ...run, mode: 'workflow' as const },
      { ...run, status: 'completed' as const },
      { ...run, purpose: 'fit' as const },
    ]) {
      daemon.service.board.record('run', changed, 'user', 'Fixture unavailable execution');
      expect((await client.callTool({ name: tool!.name, arguments: args })).isError).toBe(true);
    }
    daemon.service.board.record('run', run, 'user', 'Fixture resumed execution');
    const role = daemon.service.board.get<Role>('role', run.roleId);
    daemon.service.board.record('role', { ...role, enabled: false }, 'user', 'Paused fixture');
    expect((await client.callTool({ name: tool!.name, arguments: args })).isError).toBe(true);
    daemon.service.board.record('role', role, 'user', 'Resumed fixture');
    daemon.service.controllers.get(run.id)!.abort();
    expect((await client.callTool({ name: tool!.name, arguments: args })).isError).toBe(true);
    daemon.service.capabilities.delete('linkedin-token');
    expect((await client.callTool({ name: tool!.name, arguments: args })).isError).toBe(true);
  } finally {
    await client.close();
    daemon.service.controllers.delete(run.id);
    daemon.service.capabilities.delete('linkedin-token');
  }
});
