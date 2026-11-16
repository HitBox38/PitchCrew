import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  cardInput,
  defaultCapabilities,
  type Role,
  type Run,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { cleanup, setup } from '../../orchestrator/test/helpers/daemon.ts';

const release: (() => void)[] = [];
afterEach(async () => {
  for (const dispose of release.splice(0)) dispose();
  await cleanup();
});

const fixture = async () => {
  const { daemon, request } = await setup();
  const { board } = daemon.service;
  const role = board.get<Role>('role', 'scout');
  board.record(
    'role',
    { ...role, enabled: true, capabilities: { ...defaultCapabilities, readApplications: true } },
    'user',
    'Read-only fixture',
  );
  const card = board.createCard(cardInput.parse({ company: 'Fictional Labs', title: 'Engineer' }));
  const other = board.createCard(cardInput.parse({ company: 'Other Studio', title: 'Engineer' }));
  const run: Run = {
    id: randomUUID(),
    roleId: role.id,
    cardId: null,
    mode: 'chat',
    runtime: 'demo',
    status: 'running',
    message: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  board.record('run', run, 'user', 'Fictional read-only run');
  const token = randomUUID();
  const capability = { runId: run.id, roleId: role.id, cardId: run.cardId };
  daemon.service.capabilities.set(token, capability);
  const controller = new AbortController();
  daemon.service.controllers.set(run.id, controller);
  release.push(() => {
    daemon.service.controllers.delete(run.id);
    daemon.service.capabilities.delete(token);
  });
  const read = (input: unknown = {}) =>
    request(
      '/agent',
      'POST',
      {
        action: 'submission_attempts',
        input,
      },
      { authorization: `Bearer ${token}` },
    );
  return { daemon, board, card, other, role, run, token, capability, controller, read };
};

const attempt = (
  cardId: string,
  day: number,
  status: SubmissionAttempt['status'],
): SubmissionAttempt => ({
  id: randomUUID(),
  cardId,
  runId: randomUUID(),
  roleId: 'writer',
  computerApprovalId: randomUUID(),
  exportApprovalId: randomUUID(),
  packetDigest: 'private-digest',
  status,
  createdAt: `2026-11-0${day}T00:00:00.000Z`,
  ...(status === 'uncertain' ? {} : { resolvedAt: `2026-11-0${day}T01:00:00.000Z` }),
  before: {
    url: 'https://example.com/?token=private',
    title: 'Private page',
    text: 'Private input',
    digest: 'private-before',
  },
  evidence: 'Private quotation',
  dialogApprovalIds: [randomUUID()],
});

it('reads durable uncertain and resolved attempts as bounded private-data-free pages through real stdio', async () => {
  const { daemon, board, card, other, token } = await fixture();
  const pending = attempt(card.id, 1, 'uncertain');
  const uncertain = { ...pending, confirmation: pending.before };
  const notSubmitted = attempt(card.id, 2, 'not_submitted');
  const captured = { ...attempt(card.id, 3, 'confirmed'), confirmation: uncertain.before };
  const external = {
    ...attempt(card.id, 4, 'confirmed'),
    externalConfirmation: {
      url: 'https://example.com/?private=receipt',
      evidence: 'Private external quotation',
      verifiedAt: '2026-11-04T01:00:00.000Z',
      provenance: 'user' as const,
    },
  };
  const saved = [uncertain, notSubmitted, captured, external, attempt(other.id, 5, 'uncertain')];
  for (const value of saved) board.record('submission_attempt', value, 'user', 'Fictional history');
  board.rebuild();
  const client = new Client({ name: 'submission-attempts-test', version: '1.0.0' });
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
          PITCHCREW_RUN_TOKEN: token,
        },
        stderr: 'pipe',
      }),
    );
    expect(
      (await client.listTools()).tools.find(
        (tool) => tool.name === 'pitchcrew_read_submission_attempts',
      ),
    ).toMatchObject({
      name: 'pitchcrew_read_submission_attempts',
      annotations: expect.objectContaining({ readOnlyHint: true }),
    });
    const read = (offset: number) =>
      client.callTool({
        name: 'pitchcrew_read_submission_attempts',
        arguments: { input: { cardId: card.id, limit: 2, offset } },
      });
    const first = await read(0);
    expect(first.isError).not.toBe(true);
    expect(first.structuredContent).toEqual({
      cardId: card.id,
      total: 4,
      nextOffset: 2,
      hasUncertainAttempts: true,
      attempts: [external, captured].map((value) => ({
        id: value.id,
        cardId: card.id,
        runId: value.runId,
        roleId: value.roleId,
        status: value.status,
        createdAt: value.createdAt,
        resolvedAt: value.resolvedAt,
        confirmation: {
          browserCaptured: !!('confirmation' in value),
          externalVerifiedAt:
            'externalConfirmation' in value ? external.externalConfirmation.verifiedAt : null,
        },
      })),
    });
    const second = await read(2);
    expect(second.structuredContent).toMatchObject({
      total: 4,
      nextOffset: null,
      hasUncertainAttempts: true,
      attempts: [
        { id: notSubmitted.id, status: 'not_submitted' },
        {
          id: uncertain.id,
          status: 'uncertain',
          resolvedAt: null,
          confirmation: { browserCaptured: true, externalVerifiedAt: null },
        },
      ],
    });
    const serialized = JSON.stringify([first, second]);
    for (const privateValue of [
      'Private',
      'private-',
      'https://example.com',
      ...saved.flatMap((value) => [
        value.computerApprovalId,
        value.exportApprovalId,
        ...value.dialogApprovalIds!,
      ]),
    ])
      expect(serialized).not.toContain(privateValue);
    expect(board.list<SubmissionAttempt>('submission_attempt')).toEqual(saved);
    expect(board.list('computer_approval')).toEqual([]);
    expect(board.list('approval')).toEqual([]);
  } finally {
    await client.close();
  }
});

it('enforces attached-card, input bounds, current permission and live run boundaries at the HTTP gateway', async () => {
  const { daemon, board, card, other, role, run, capability, controller, read } = await fixture();
  expect((await read()).response.ok).toBe(false);
  for (const input of [
    { cardId: card.id, limit: 51 },
    { cardId: card.id, offset: -1 },
    { cardId: card.id, extra: true },
  ])
    expect((await read(input)).response.ok).toBe(false);
  expect((await read({ cardId: other.id })).result).toEqual({
    cardId: other.id,
    attempts: [],
    total: 0,
    nextOffset: null,
    hasUncertainAttempts: false,
  });
  expect((await read({ cardId: randomUUID() })).response.ok).toBe(false);
  board.record(
    'card',
    { ...other, deletedAt: new Date().toISOString() },
    'user',
    'Delete fixture job',
  );
  expect((await read({ cardId: other.id })).response.ok).toBe(false);
  capability.cardId = card.id;
  expect((await read()).response.ok).toBe(false);
  const attached = { ...run, cardId: card.id };
  board.record('run', attached, 'user', 'Attach fixture run');
  expect((await read()).response.ok).toBe(true);
  expect((await read({ cardId: other.id })).response.ok).toBe(false);
  for (const purpose of [
    'application-draft',
    'application-review',
    'fit',
    'packet-evaluation',
    'source-extraction',
  ] as const) {
    board.record('run', { ...attached, purpose }, 'user', 'Isolated fixture run');
    expect((await read()).response.ok).toBe(false);
  }
  board.record('run', attached, 'user', 'Restore fixture run');
  board.record(
    'role',
    { ...role, enabled: true, capabilities: defaultCapabilities },
    'user',
    'Revoke read applications',
  );
  expect((await read()).response.ok).toBe(false);
  board.record(
    'role',
    { ...role, enabled: false, capabilities: { ...defaultCapabilities, readApplications: true } },
    'user',
    'Pause fixture role',
  );
  expect((await read()).response.ok).toBe(false);
  board.record(
    'role',
    { ...role, enabled: true, capabilities: { ...defaultCapabilities, readApplications: true } },
    'user',
    'Restore read permission',
  );
  daemon.service.controllers.delete(run.id);
  expect((await read()).response.ok).toBe(false);
  daemon.service.controllers.set(run.id, controller);
  controller.abort();
  expect((await read()).response.ok).toBe(false);
  daemon.service.controllers.set(run.id, new AbortController());
  board.record('run', { ...attached, status: 'completed' }, 'user', 'Complete fixture run');
  expect((await read()).response.ok).toBe(false);
});

it('caps pages and orders equal timestamps consistently without hiding older uncertainty', async () => {
  const { board, card, read } = await fixture();
  const saved = Array.from({ length: 55 }, () => attempt(card.id, 2, 'not_submitted'));
  const oldest = attempt(card.id, 1, 'uncertain');
  for (const value of [...saved, oldest])
    board.record('submission_attempt', value, 'user', 'Fictional paged history');
  const expected = saved
    .map((value) => value.id)
    .sort()
    .reverse();
  const defaultPage = (await read({ cardId: card.id })).result as { attempts: { id: string }[] };
  expect(defaultPage.attempts.map((value) => value.id)).toEqual(expected.slice(0, 20));
  const first = (await read({ cardId: card.id, limit: 50 })).result as {
    attempts: { id: string }[];
  };
  expect(first.attempts.map((value) => value.id)).toEqual(expected.slice(0, 50));
  expect(first).toMatchObject({ total: 56, nextOffset: 50, hasUncertainAttempts: true });
  const second = (await read({ cardId: card.id, limit: 50, offset: 50 })).result as {
    attempts: { id: string }[];
  };
  expect(second.attempts.map((value) => value.id)).toEqual([...expected.slice(50), oldest.id]);
  expect(second).toMatchObject({ nextOffset: null, hasUncertainAttempts: true });
  expect((await read({ cardId: card.id, offset: 100 })).result).toMatchObject({
    attempts: [],
    total: 56,
    nextOffset: null,
    hasUncertainAttempts: true,
  });
});
