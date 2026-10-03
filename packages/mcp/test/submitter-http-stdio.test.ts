import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  cardInput,
  defaultCapabilities,
  type Approval,
  type Card,
  type Role,
  type Run,
} from '@pitchcrew/core';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import { packet } from '../../board/test/fixtures/packet.ts';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

afterEach(cleanup);
it('generates reviewed artifact previews before approval and exports exact bytes only through the gate', async () => {
  const { daemon, request } = await setup(14700);
  await daemon.service.saveProfile('profile.md', 'Built React interfaces.');
  const board = daemon.service.board;
  const card = board.createCard(cardInput.parse({ company: 'Fixture Studio', title: 'Engineer' }));
  for (const state of ['shortlisted', 'drafting'] as const) board.move(card.id, state, 'user');
  board.updateCard(card.id, { packet }, 'writer', 'Fictional packet');
  for (const state of ['in_review', 'agreed'] as const) board.move(card.id, state, 'reviewer');
  const { response, result: approval } = await request<Approval>(
    `/cards/${card.id}/approval`,
    'POST',
    { formats: ['pdf', 'docx'] },
  );
  expect(response.status).toBe(201);
  expect(approval.artifacts).toHaveLength(4);
  expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(400);
  await request(`/approvals/${approval.id}/decide`, 'POST', { approved: true });
  expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(200);
  expect((await request(`/approvals/${approval.id}/export`, 'POST')).response.status).toBe(400);
});

it('exposes scoped form/receipt tools through real MCP stdio and rechecks revoked permissions', async () => {
  const { daemon } = await setup(14701);
  const board = daemon.service.board;
  const card = board.createCard(cardInput.parse({ company: 'Fixture Studio', title: 'Engineer' }));
  const role = board.get<Role>('role', 'writer');
  board.record(
    'role',
    {
      ...role,
      capabilities: {
        ...defaultCapabilities,
        computerUse: true,
        assessForms: true,
        recordSubmissions: true,
      },
    },
    'user',
    'Enable fictional capabilities',
  );
  const run: Run = {
    id: 'submitter-stdio',
    cardId: card.id,
    roleId: role.id,
    mode: 'chat',
    runtime: 'demo',
    status: 'running',
    message: '',
    startedAt: '',
    finishedAt: null,
  };
  board.record('run', run, 'user', 'Fictional tool run');
  daemon.service.capabilities.set('submitter-token', {
    runId: run.id,
    cardId: card.id,
    roleId: role.id,
  });
  vi.spyOn(daemon.service.computer, 'inspect').mockResolvedValue({
    url: 'https://example.com/apply',
    title: 'Fixture',
    text: 'Name',
    screenshot: '',
    digest: 'fixture',
    controls: [
      {
        selector: '#name',
        label: 'Name',
        type: 'text',
        required: true,
        disabled: false,
        visible: true,
        accept: '',
        options: [],
      },
    ],
  });
  const client = new Client({ name: 'submitter-test', version: '1.0.0' });
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
          PITCHCREW_RUN_TOKEN: 'submitter-token',
        },
        stderr: 'pipe',
      }),
    );
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['pitchcrew_assess_form', 'pitchcrew_capture_submission']),
    );
    const assessed = await client.callTool({
      name: 'pitchcrew_assess_form',
      arguments: { input: { fields: [{ selector: '#name', missingAnswer: 'Legal name' }] } },
    });
    expect(assessed.isError).not.toBe(true);
    expect(board.get<Card>('card', card.id).formAssessments?.[0]?.fields[0]).toMatchObject({
      required: true,
      missingAnswer: 'Legal name',
    });
    board.record(
      'role',
      { ...role, capabilities: { ...defaultCapabilities, computerUse: true, assessForms: false } },
      'user',
      'Revoke assessment',
    );
    const revoked = await client.callTool({
      name: 'pitchcrew_assess_form',
      arguments: { input: { fields: [] } },
    });
    expect(revoked.isError).toBe(true);
    expect(board.get<Card>('card', card.id).formAssessments).toHaveLength(1);
    await expect(
      daemon.service.agentCall('submitter-token', 'computer_request', {
        input: { kind: 'click', selector: '#submit', purpose: 'submission' },
        reason: 'Submit',
      }),
    ).rejects.toThrow('disabled');
    await expect(
      daemon.service.agentCall('submitter-token', 'resolve_submission', { input: {} }),
    ).rejects.toThrow('not allowed');
  } finally {
    await client.close();
  }
});
