import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { createDaemon } from '../../orchestrator/src/server.ts';
import { cardInput } from '@pitchcrew/core';
import { packet, profile } from './fixtures/evaluation.ts';

it('connects the real stdio server to a scoped daemon and preserves approval boundaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-mcp-test-'));
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-mcp-test-'))).toBe(true);
  const daemon = await createDaemon({ directory, port: 14431 });
  const client = new Client({ name: 'pitchcrew-contract-test', version: '1.0.0' });
  try {
    await new Promise<void>((resolve) => daemon.http.listen(14431, '127.0.0.1', resolve));
    for (const file of profile) await daemon.service.saveProfile(file.name, file.content);
    const board = daemon.service.board;
    const card = board.createCard(
      cardInput.parse({
        company: 'Fixture Studio',
        title: 'Frontend Engineer',
        description: 'Build accessible scheduling interfaces.',
      }),
    );
    board.move(card.id, 'shortlisted', 'user');
    board.move(card.id, 'drafting', 'writer');
    board.updateCard(card.id, { packet }, 'writer', 'Drafted packet');
    board.move(card.id, 'in_review', 'writer');
    board.updateCard(
      card.id,
      { feedback: ['The earlier latency claim had no evidence.'] },
      'reviewer',
      'Requested evidence correction',
    );
    board.move(card.id, 'changes_requested', 'reviewer');
    board.move(card.id, 'drafting', 'writer');
    board.move(card.id, 'in_review', 'writer');
    board.updateCard(card.id, { feedback: [] }, 'reviewer', 'Verified corrected source quotes');
    board.move(card.id, 'agreed', 'reviewer');
    const approval = board.requestApproval(card.id);
    // A deterministic capability fixture avoids launching or spending tokens on a provider CLI.
    board.record(
      'run',
      {
        id: 'fixture',
        cardId: card.id,
        roleId: 'reviewer',
        runtime: 'demo',
        status: 'running',
        message: 'Fixture capability',
        startedAt: '',
        finishedAt: null,
      },
      'reviewer',
      'Fixture run',
    );
    const token = 'fixture-run-capability';
    daemon.service.capabilities.set(token, {
      runId: 'fixture',
      cardId: card.id,
      roleId: 'reviewer',
    });
    const transport = new StdioClientTransport({
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
        PITCHCREW_RUN_TOKEN: token,
      },
      stderr: 'pipe',
    });
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      [
        'pitchcrew_export_packet',
        'pitchcrew_get_card',
        'pitchcrew_get_history',
        'pitchcrew_lint_packet',
        'pitchcrew_read_profile',
        'pitchcrew_read_messages',
        'pitchcrew_message_agent',
        'pitchcrew_invoke_agent',
        'pitchcrew_propose_role_changes',
        'pitchcrew_change_workflow',
      ].sort(),
    );
    const proposed = await client.callTool({
      name: 'pitchcrew_propose_role_changes',
      arguments: {
        reason: 'Use stricter evidence checks.',
        changes: { instructions: 'Check every registered quotation.' },
      },
    });
    expect(proposed.structuredContent).toMatchObject({
      proposal: { roleId: 'reviewer', status: 'pending' },
    });
    const messaged = await client.callTool({
      name: 'pitchcrew_message_agent',
      arguments: { roleId: 'writer', content: 'Please explain your evidence sources.' },
    });
    expect(messaged.structuredContent).toMatchObject({
      task: { roleId: 'writer', status: 'queued', mode: 'chat' },
    });
    const messages = await client.callTool({ name: 'pitchcrew_read_messages', arguments: {} });
    expect(messages.structuredContent).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({ threadId: 'crew', from: 'reviewer', to: 'writer' }),
      ]),
    });
    const current = await client.callTool({ name: 'pitchcrew_get_card', arguments: {} });
    expect(current.structuredContent).toMatchObject({
      card: { id: card.id, packet, state: 'awaiting_approval' },
    });
    const sources = await client.callTool({ name: 'pitchcrew_read_profile', arguments: {} });
    expect(sources.structuredContent).toMatchObject({ profile: expect.arrayContaining(profile) });
    const first = await client.callTool({ name: 'pitchcrew_get_history', arguments: { limit: 2 } });
    const page = first.structuredContent as { events: { id: number }[]; nextCursor: number };
    expect(page.events).toHaveLength(2);
    const older = await client.callTool({
      name: 'pitchcrew_get_history',
      arguments: { beforeEventId: page.nextCursor, limit: 2 },
    });
    expect(
      (older.structuredContent as { events: { id: number }[] }).events.every(
        (event) => event.id < page.nextCursor,
      ),
    ).toBe(true);
    expect(
      (await client.callTool({ name: 'pitchcrew_lint_packet', arguments: { packet } }))
        .structuredContent,
    ).toEqual({ problems: [] });
    const unsupported = { ...packet, claims: [{ ...packet.claims[0], source: 'missing.md' }] };
    expect(
      (await client.callTool({ name: 'pitchcrew_lint_packet', arguments: { packet: unsupported } }))
        .structuredContent,
    ).toMatchObject({
      problems: expect.arrayContaining([expect.stringContaining('Source does not support')]),
    });
    expect(
      (
        await client.callTool({
          name: 'pitchcrew_export_packet',
          arguments: { approvalId: approval.id },
        })
      ).isError,
    ).toBe(true);
    board.decideApproval(approval.id, true);
    expect(
      (
        await client.callTool({
          name: 'pitchcrew_export_packet',
          arguments: { approvalId: approval.id },
        })
      ).isError,
    ).not.toBe(true);
    expect(
      (
        await client.callTool({
          name: 'pitchcrew_export_packet',
          arguments: { approvalId: approval.id },
        })
      ).isError,
    ).toBe(true);
    daemon.service.capabilities.delete(token);
    expect((await client.callTool({ name: 'pitchcrew_read_profile', arguments: {} })).isError).toBe(
      true,
    );
  } finally {
    await client.close();
    await daemon.close();
    await rm(directory, { recursive: true, force: true });
  }
});
