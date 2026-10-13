import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { cardInput, defaultCapabilities, type Role, type Run } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';
import { confirmFixtureJob } from '../../board/test/fixtures/application-context.ts';

afterEach(cleanup);
it('exposes no extraction tools and only application-scoped drafting/review tools over real stdio', async () => {
  const { daemon } = await setup(22381);
  const writer = daemon.service.board.get<Role>('role', 'writer');
  daemon.service.board.record(
    'role',
    {
      ...writer,
      capabilities: { ...defaultCapabilities, ...writer.capabilities, discoverJobs: true },
    },
    'user',
    'Enable discovery to verify isolated runs cannot import job sources',
  );
  const card = daemon.service.board.createCard(
    cardInput.parse({ company: 'Fixture', title: 'Engineer', description: 'RAW-HIDDEN-DIRECTIVE' }),
  );
  confirmFixtureJob(daemon.service.board, card.id);
  for (const purpose of ['source-extraction', 'application-draft', 'application-review'] as const) {
    const id = `stdio-${purpose}`;
    const run: Run = {
      id,
      purpose,
      roleId: 'writer',
      cardId: card.id,
      runtime: 'demo',
      mode: 'workflow',
      contextRevision: daemon.service.board.get<import('@pitchcrew/core').Card>('card', card.id)
        .applicationContext!.revision,
      status: 'running',
      message: 'Fixture',
      startedAt: '',
      finishedAt: null,
    };
    daemon.service.board.record('run', run, 'user', 'Fictional execution purpose');
    daemon.service.controllers.set(id, new AbortController());
    daemon.service.capabilities.set(id, { runId: id, cardId: card.id, roleId: 'writer' });
    const client = new Client({ name: 'application-scope-test', version: '1.0.0' });
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
            PITCHCREW_RUN_TOKEN: id,
          },
          stderr: 'pipe',
        }),
      );
      if (purpose === 'source-extraction') {
        expect(client.getServerCapabilities()?.tools).toBeUndefined();
        await expect(client.listTools()).rejects.toThrow('Method not found');
        await expect(
          client.callTool({ name: 'pitchcrew_read_profile', arguments: {} }),
        ).rejects.toThrow('Method not found');
      } else {
        const names = (await client.listTools()).tools.map((tool) => tool.name);
        expect(names.sort()).toEqual(
          [
            'pitchcrew_ask_user',
            'pitchcrew_get_card',
            'pitchcrew_get_packet_rules',
            'pitchcrew_lint_packet',
            'pitchcrew_notify_user',
            'pitchcrew_read_profile',
          ].sort(),
        );
        const result = await client.callTool({ name: 'pitchcrew_get_card', arguments: {} });
        expect(result.isError).not.toBe(true);
        expect(JSON.stringify(result)).not.toContain('RAW-HIDDEN-DIRECTIVE');
      }
      if (purpose !== 'source-extraction') {
        const forbidden = await client.callTool({ name: 'pitchcrew_get_history', arguments: {} });
        expect(forbidden.isError).toBe(true);
      }
    } finally {
      await client.close();
      daemon.service.controllers.delete(id);
      daemon.service.capabilities.delete(id);
      daemon.service.board.record(
        'run',
        { ...run, status: 'completed' },
        'user',
        'Finished fixture',
      );
    }
  }
});
