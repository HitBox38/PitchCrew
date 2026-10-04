import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { cardInput, defaultCapabilities, type Role } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { createDaemon } from '../../orchestrator/src/server.ts';
import { packet, profile } from './fixtures/evaluation.ts';

it('connects the real stdio server to a scoped daemon and preserves approval boundaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-mcp-test-'));
  expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-mcp-test-'))).toBe(true);
  const daemon = await createDaemon({ dev: true, directory, port: 14431, seedSkills: false });
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
        'pitchcrew_list_connectors',
        'pitchcrew_list_roles',
        'pitchcrew_get_card',
        'pitchcrew_get_history',
        'pitchcrew_lint_packet',
        'pitchcrew_get_packet_rules',
        'pitchcrew_read_profile',
        'pitchcrew_read_messages',
        'pitchcrew_message_agent',
        'pitchcrew_notify_user',
        'pitchcrew_invoke_agent',
        'pitchcrew_propose_role_changes',
        'pitchcrew_propose_skill',
        'pitchcrew_change_workflow',
        'pitchcrew_list_routines',
        'pitchcrew_save_routine',
        'pitchcrew_delete_routine',
        'pitchcrew_list_watched_profile_sources',
        'pitchcrew_detect_profile_changes',
        'pitchcrew_read_project_watch_file',
        'pitchcrew_propose_profile_note',
        'pitchcrew_search_applications',
        'pitchcrew_application_insights',
        'pitchcrew_scan_application_mail',
        'pitchcrew_reconcile_application_mail',
      ].sort(),
    );
    const routineInput = {
      name: 'Fictional scheduled check',
      roleId: 'writer',
      content: 'Review fictional applications.',
      startAt: '2030-01-01T09:00:00Z',
      timezone: 'UTC',
      intervalMinutes: 60,
      maxRuns: 3,
    };
    const scheduled = await client.callTool({
      name: 'pitchcrew_save_routine',
      arguments: { input: routineInput },
    });
    expect(scheduled.isError).not.toBe(true);
    expect(scheduled.structuredContent).toMatchObject({
      routine: { createdBy: 'reviewer', roleId: 'writer', maxRuns: 3, runCount: 0 },
    });
    const routineId = (scheduled.structuredContent as { routine: { id: string } }).routine.id;
    const routineList = await client.callTool({ name: 'pitchcrew_list_routines', arguments: {} });
    expect(routineList.structuredContent).toMatchObject({
      routines: [expect.objectContaining({ id: routineId })],
    });
    const edited = await client.callTool({
      name: 'pitchcrew_save_routine',
      arguments: {
        routineId,
        input: { ...routineInput, name: 'Edited scheduled check', enabled: false },
      },
    });
    expect(edited.structuredContent).toMatchObject({
      routine: { id: routineId, name: 'Edited scheduled check', enabled: false },
    });
    expect(
      (await client.callTool({ name: 'pitchcrew_delete_routine', arguments: { routineId } }))
        .structuredContent,
    ).toMatchObject({ ok: true });
    expect(daemon.service.routines()).toEqual([]);
    const notified = await client.callTool({
      name: 'pitchcrew_notify_user',
      arguments: { kind: 'attention', content: 'Which fictional profile should I review?' },
    });
    expect(notified.structuredContent).toMatchObject({
      message: { from: 'reviewer', to: 'user', notification: 'attention' },
    });
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
    const suggested = await client.callTool({
      name: 'pitchcrew_propose_skill',
      arguments: {
        reason: 'Use a shared evidence checklist.',
        suggestion: {
          kind: 'custom',
          skill: {
            name: 'Evidence checklist',
            content: 'Verify each quote against the profile.',
            scope: 'all',
            roleIds: [],
          },
        },
      },
    });
    expect(suggested.structuredContent).toMatchObject({
      proposal: {
        roleId: 'reviewer',
        threadId: 'crew',
        status: 'pending',
        skill: { name: 'Evidence checklist' },
      },
    });
    expect((await daemon.service.snapshot()).skills).toEqual([]);
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
    ).toEqual({
      problems: [],
      warnings: [],
      findings: [],
      layout: { resumePages: 1, coverLetterPages: 1, warnings: [] },
    });
    const rules = await client.callTool({ name: 'pitchcrew_get_packet_rules', arguments: {} });
    expect(rules.structuredContent).toMatchObject({
      custom: false,
      error: null,
      rules: { version: 1, rules: [{ id: 'resume-length' }, { id: 'cover-letter-length' }] },
      summary: expect.stringContaining('resume-length (error) Resume: at most 650 words.'),
    });
    const long = { ...packet, coverLetter: `${packet.coverLetter} ${'word '.repeat(500)}` };
    expect(
      (await client.callTool({ name: 'pitchcrew_lint_packet', arguments: { packet: long } }))
        .structuredContent,
    ).toMatchObject({
      problems: ['Cover letter exceeds 500 words.'],
      findings: [{ ruleId: 'cover-letter-length', severity: 'error', document: 'coverLetter' }],
    });
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

it('discovers permitted connector tools over stdio and rechecks role permissions on every call', async () => {
  const { vi } = await import('vitest');
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-mcp-test-'));
  const daemon = await createDaemon({ dev: true, directory, port: 14432, seedSkills: false });
  const client = new Client({ name: 'connector-contract-test', version: '1.0.0' });
  const token = 'fixture-connector-capability';
  const controller = new AbortController();
  const connectorCall = vi
    .spyOn(daemon.service.connectors, 'call')
    .mockResolvedValue({ text: 'Fixture project' });
  try {
    await new Promise<void>((resolve) => daemon.http.listen(14432, '127.0.0.1', resolve));
    const current = daemon.service.board.get<Role>('role', 'scout');
    await daemon.service.configureRole('scout', {
      ...current,
      capabilities: { ...defaultCapabilities, github: true, computerUse: true },
    });
    daemon.service.capabilities.set(token, {
      runId: 'connector-fixture',
      cardId: null,
      roleId: 'scout',
    });
    daemon.service.controllers.set('connector-fixture', controller);
    daemon.service.board.record(
      'run',
      {
        id: 'connector-fixture',
        cardId: null,
        roleId: 'scout',
        runtime: 'demo',
        status: 'running',
        message: '',
        startedAt: '',
        finishedAt: null,
      },
      'user',
      'Scoped fixture run',
    );
    vi.spyOn(daemon.service.computer, 'inspect').mockResolvedValue({
      url: 'https://example.com',
      title: 'Fixture browser',
      text: 'Name Apply',
      screenshot: 'aW1hZ2U=',
      digest: 'fixture-page',
    });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          '--import',
          import.meta.resolve('tsx'),
          fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
        ],
        env: { PITCHCREW_DAEMON_URL: daemon.url, PITCHCREW_RUN_TOKEN: token },
        stderr: 'pipe',
      }),
    );
    const listed = (await client.listTools()).tools;
    expect(listed.some((t) => t.name === 'github_read_file')).toBe(true);
    expect(listed.some((t) => t.name.startsWith('gmail_'))).toBe(false);
    expect(
      listed
        .filter((t) => t.name.startsWith('pitchcrew_computer_'))
        .map((t) => t.name)
        .sort(),
    ).toEqual([
      'pitchcrew_computer_execute',
      'pitchcrew_computer_inspect',
      'pitchcrew_computer_request',
    ]);
    const inspected = await client.callTool({ name: 'pitchcrew_computer_inspect', arguments: {} });
    expect(inspected.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'image', mimeType: 'image/jpeg' })]),
    );
    expect(inspected.structuredContent).toMatchObject({ page: { title: 'Fixture browser' } });
    const requested = await client.callTool({
      name: 'pitchcrew_computer_request',
      arguments: { input: { kind: 'click', selector: '#submit' }, reason: 'Submit fictional form' },
    });
    expect(requested.structuredContent).toMatchObject({
      approval: { status: 'pending', runId: 'connector-fixture' },
    });
    expect(listed.find((t) => t.name === 'github_read_file')?.annotations).toMatchObject({
      readOnlyHint: true,
      openWorldHint: true,
    });
    const input = { owner: 'fixture', repo: 'portfolio', path: 'README.md' };
    expect(
      (await client.callTool({ name: 'github_read_file', arguments: input })).structuredContent,
    ).toMatchObject({ text: 'Fixture project' });
    expect(connectorCall).toHaveBeenCalledWith('github_read_file', input, controller.signal);
    const discovery = await client.callTool({ name: 'pitchcrew_list_connectors', arguments: {} });
    expect(discovery.structuredContent).toMatchObject({
      connectors: [expect.objectContaining({ id: 'github', connected: false })],
    });
    const post = async (action: string, tool: string) =>
      fetch(`${daemon.url}/api/agent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, tool, input: {} }),
      });
    expect((await post('connector', 'gmail_search_messages')).status).toBe(400);
    expect((await post('connector', 'github_create_issue')).status).toBe(400);
    expect((await post('connect_github', 'github_read_file')).status).toBe(400);
    expect(connectorCall).toHaveBeenCalledTimes(1);
    // Emulate revocation in stored settings to prove a discovered tool cannot bypass a current permission check.
    daemon.service.board.record(
      'role',
      { ...current, capabilities: defaultCapabilities },
      'user',
      'Disabled GitHub fixture access',
    );
    expect((await client.callTool({ name: 'github_read_file', arguments: input })).isError).toBe(
      true,
    );
    expect(connectorCall).toHaveBeenCalledTimes(1);
    expect(
      (await client.callTool({ name: 'pitchcrew_computer_inspect', arguments: {} })).isError,
    ).toBe(true);
    controller.abort();
    expect(
      (await client.callTool({ name: 'pitchcrew_list_connectors', arguments: {} })).isError,
    ).toBe(true);
  } finally {
    connectorCall.mockRestore();
    vi.restoreAllMocks();
    daemon.service.controllers.delete('connector-fixture');
    daemon.service.capabilities.delete(token);
    await client.close();
    await daemon.close();
    expect(resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-mcp-test-'))).toBe(true);
    await rm(directory, { recursive: true, force: true });
  }
});
