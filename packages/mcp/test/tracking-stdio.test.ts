import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { defaultCapabilities, type Card, type Role, type TrackingScan } from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { setup, cleanup } from '../../orchestrator/test/helpers/daemon.ts';
import { gmailMessage } from '../src/connectors/tools/helpers.ts';

it('searches, scans and verifies actual normalized Gmail evidence through real stdio and HTTP envelopes', async () => {
  const { daemon, request } = await setup(14587);
  const client = new Client({ name: 'tracking-contract-test', version: '1.0.0' });
  try {
    const role = daemon.service.board.get<Role>('role', 'scout');
    daemon.service.board.record(
      'role',
      {
        ...role,
        capabilities: {
          ...defaultCapabilities,
          readApplications: true,
          trackApplications: true,
          gmail: true,
        },
      },
      'user',
      'Enable fixture tracking',
    );
    daemon.service.capabilities.set('tracking-token', {
      runId: 'tracking-fixture',
      roleId: 'scout',
      cardId: null,
    });
    daemon.service.controllers.set('tracking-fixture', new AbortController());
    vi.spyOn(daemon.service.connectors, 'status').mockReturnValue([
      {
        id: 'google',
        account: 'fictional@example.com',
        connected: true,
        services: ['gmail'],
        configured: true,
        pending: false,
        error: '',
      },
    ]);
    const text =
      'Fictional Labs Frontend Engineer. We would like to invite you to an interview. https://jobs.example.com/123';
    const call = vi.spyOn(daemon.service.connectors, 'call').mockImplementation(async (tool) =>
      tool === 'gmail_search_messages'
        ? { messages: [{ id: 'gmail1' }] }
        : gmailMessage({
            id: 'gmail1',
            threadId: 'thread1',
            internalDate: String(Date.parse('2025-03-01T00:00:00Z')),
            snippet: text,
            payload: {
              mimeType: 'text/plain',
              body: { data: Buffer.from(text).toString('base64url') },
              headers: [{ name: 'Subject', value: 'Interview invitation' }],
            },
          }),
    );
    const card = (
      await request<Card>('/tracking/external', 'POST', {
        company: 'Fictional Labs',
        title: 'Frontend Engineer',
        url: 'https://jobs.example.com/123',
        submittedAt: '2025-01-01T00:00:00Z',
        note: 'Confirmed external submission.',
      })
    ).result;
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
          PITCHCREW_RUN_TOKEN: 'tracking-token',
        },
        stderr: 'pipe',
      }),
    );
    const result = await client.callTool({
      name: 'pitchcrew_search_applications',
      arguments: { input: { company: 'Fictional Labs', title: 'Frontend Engineer', limit: 1 } },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      cards: [expect.objectContaining({ id: card.id })],
    });
    const scanned = await client.callTool({
      name: 'pitchcrew_scan_application_mail',
      arguments: { input: { query: 'subject:interview' } },
    });
    const scan = (scanned.structuredContent as { scan: TrackingScan }).scan;
    expect(scan.pendingIds).toEqual(['gmail1']);
    const input = {
      scanId: scan.id,
      messageId: 'gmail1',
      company: 'Fictional Labs',
      title: 'Frontend Engineer',
      state: 'interviewing',
      quote: 'We would like to invite you to an interview.',
    };
    const reconciled = await client.callTool({
      name: 'pitchcrew_reconcile_application_mail',
      arguments: { input },
    });
    expect(reconciled.isError).not.toBe(true);
    expect(reconciled.structuredContent).toMatchObject({
      evidence: { status: 'applied', cardId: card.id, messageId: 'gmail1', threadId: 'thread1' },
    });
    expect(daemon.service.board.get<Card>('card', card.id).state).toBe('interviewing');
    daemon.service.board.record(
      'role',
      { ...role, capabilities: defaultCapabilities },
      'user',
      'Revoke fixture permissions',
    );
    expect(
      (await client.callTool({ name: 'pitchcrew_search_applications', arguments: { input: {} } }))
        .isError,
    ).toBe(true);
    expect(
      (
        await client.callTool({
          name: 'pitchcrew_reconcile_application_mail',
          arguments: { input },
        })
      ).isError,
    ).toBe(true);
    expect(call).toHaveBeenCalledTimes(2);
  } finally {
    daemon.service.controllers.delete('tracking-fixture');
    daemon.service.capabilities.delete('tracking-token');
    await client.close();
    await cleanup();
  }
});
