import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Card, ChatMessage, ChatRequest, Conversation, Run } from '@pitchcrew/core';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { cleanup, finish, setup, waitForSnapshot } from '../../orchestrator/test/helpers/daemon.ts';
import {
  disableExternalAccess,
  enableExternalAccess,
  readExternalAccess,
} from '../src/external/access.ts';

const execute = promisify(execFile);
const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await cleanup();
});
const cli = fileURLToPath(new URL('../../orchestrator/src/cli.ts', import.meta.url));
const command = async (directory: string, ...args: string[]) =>
  execute(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), cli, 'mcp', ...args, '--home', directory],
    { cwd: directory },
  );
const connect = async (directory: string, port: number) => {
  const { stdout } = await command(directory, 'config', '--port', String(port));
  const config = JSON.parse(stdout).mcpServers.pitchcrew as { command: string; args: string[] };
  const client = new Client({ name: 'external-agent-fixture', version: '1.0.0' });
  clients.push(client);
  await client.connect(new StdioClientTransport({ ...config, cwd: directory, stderr: 'pipe' }));
  return client;
};

it('connects from another working directory, advertises read-only tools and revokes live connections', async () => {
  const { daemon, directory } = await setup(15621);
  expect(JSON.parse((await command(directory, 'status')).stdout)).toEqual({
    enabled: false,
    write: false,
  });
  await expect(command(directory, 'serve')).rejects.toThrow('disabled');
  await command(directory, 'enable');
  const access = (await readExternalAccess(directory))!;
  if (process.platform !== 'win32')
    expect((await stat(join(directory, 'external-mcp.json'))).mode & 0o777).toBe(0o600);
  const config = await command(directory, 'config');
  expect(config.stdout).not.toContain(access.token);
  const client = await connect(directory, Number(new URL(daemon.url).port));
  const tools = (await client.listTools()).tools;
  expect(tools).toHaveLength(8);
  expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
  const result = await client.callTool({ name: 'pitchcrew_status', arguments: {} });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toMatchObject({
    jobs: 0,
    agents: expect.arrayContaining([expect.objectContaining({ id: 'scout' })]),
  });
  expect(
    (
      await client.callTool({
        name: 'pitchcrew_create_job',
        arguments: { company: 'Acme', title: 'Engineer' },
      })
    ).isError,
  ).toBe(true);
  const forbiddenWrite = await fetch(`${daemon.url}/api/external-mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'create_job', input: { company: 'Acme', title: 'Engineer' } }),
  });
  expect(forbiddenWrite.status).toBe(403);
  await command(directory, 'disable');
  expect((await client.callTool({ name: 'pitchcrew_status', arguments: {} })).isError).toBe(true);
  expect(daemon.service.board.list('card')).toHaveLength(0);
}, 30000);

it('keeps host/origin, run, user and external credentials separate and rejects unadvertised actions', async () => {
  const { daemon, directory, cookie, request } = await setup(15622);
  await enableExternalAccess(directory, true);
  const access = (await readExternalAccess(directory))!;
  const authorization = `Bearer ${access.token}`;
  const headers = {
    host: new URL(daemon.url).host,
    authorization,
    'content-type': 'application/json',
  };
  daemon.service.capabilities.set('crew-run-token', {
    runId: 'fixture-run',
    roleId: 'scout',
    cardId: null,
  });
  for (const method of ['GET', 'PUT'] as const)
    expect(
      (
        await daemon.app.inject({
          method,
          url: '/api/external-mcp/access',
          headers,
          ...(method === 'PUT' ? { payload: { enabled: true, write: true } } : {}),
        })
      ).statusCode,
    ).toBe(403);
  const info = await request<{ configuration: unknown; enabled: boolean; write: boolean }>(
    '/external-mcp/access',
  );
  expect(info.result).toMatchObject({ enabled: true, write: true });
  expect(JSON.stringify(info.result)).not.toContain(access.token);
  const { stdout } = await command(directory, 'config', '--port', new URL(daemon.url).port);
  expect(info.result.configuration).toEqual(JSON.parse(stdout));
  for (const extra of [
    { host: 'localhost:15622' },
    { origin: 'https://example.invalid' },
    { 'sec-fetch-site': 'cross-site' },
    { authorization: '' },
    { authorization: 'Bearer crew-run-token' },
  ]) {
    const response = await daemon.app.inject({
      method: 'POST',
      url: '/api/external-mcp',
      headers: { ...headers, ...extra },
      payload: '{',
    });
    expect(response.statusCode).toBe(403);
  }
  expect(
    (
      await daemon.app.inject({
        method: 'POST',
        url: '/api/external-mcp',
        headers: { host: headers.host, cookie, 'x-pitchcrew-client': 'ui' },
        payload: { action: 'status', input: {} },
      })
    ).statusCode,
  ).toBe(403);
  for (const url of ['/api/agent', '/api/cards', '/api/roles'])
    expect(
      (await daemon.app.inject({ method: 'POST', url, headers, payload: {} })).statusCode,
    ).toBe(403);
  const before = daemon.service.board.events();
  for (const action of [
    'export_packet',
    'decide_approval',
    'configure_role',
    'connector_call',
    'browser_action',
    'save_profile',
    'save_skill',
  ])
    expect(
      (
        await daemon.app.inject({
          method: 'POST',
          url: '/api/external-mcp',
          headers,
          payload: { action, input: {} },
        })
      ).statusCode,
    ).toBe(400);
  expect(daemon.service.board.events()).toEqual(before);
  expect(
    (await request('/external-mcp/access', 'PUT', { enabled: true, write: false })).response.status,
  ).toBe(200);
  expect(
    (
      await daemon.app.inject({
        method: 'POST',
        url: '/api/external-mcp',
        headers,
        payload: { action: 'status', input: {} },
      })
    ).statusCode,
  ).toBe(403);
  await disableExternalAccess(directory);
});

it('manages jobs, preserves busy checks and delegates visible crew work through actual stdio', async () => {
  const { daemon, directory, request } = await setup(15623);
  await command(directory, 'enable', '--write');
  const client = await connect(directory, Number(new URL(daemon.url).port));
  expect((await client.listTools()).tools).toHaveLength(14);
  const call = async <T>(name: string, input: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name: `pitchcrew_${name}`, arguments: input });
    expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
    return result.structuredContent as T;
  };
  const { card } = await call<{ card: Card }>('create_job', {
    company: 'Acme',
    title: 'Engineer',
    description: 'Fictional React role',
  });
  expect(daemon.service.board.history(card.id)[0].actor).toBe('external-mcp');
  const second = await call<{ card: Card }>('create_job', { company: 'Other', title: 'Designer' });
  const listed = await call<{ items: Card[]; nextOffset: number }>('list_jobs', { limit: 1 });
  expect(listed.items).toHaveLength(1);
  expect(listed.nextOffset).toBe(1);
  expect(
    (await call<{ items: Card[] }>('list_jobs', { query: 'acme' })).items.map((item) => item.id),
  ).toEqual([card.id]);
  await call('move_job', { cardId: card.id, state: 'shortlisted', reason: 'Relevant React role' });
  await call('update_job', {
    cardId: card.id,
    changes: { title: 'Senior Engineer' },
    reason: 'Corrected posting title',
  });
  expect((await call<{ card: Card }>('read_job', { cardId: card.id })).card.title).toBe(
    'Senior Engineer',
  );
  const { result: conversation } = await request<Conversation>('/conversations', 'POST', {
    title: 'Existing chat',
    participants: ['scout'],
    cardId: card.id,
  });
  const { conversation: created } = await call<{ conversation: Conversation }>(
    'create_conversation',
    { title: 'External research', participants: ['scout'] },
  );
  expect(created.createdBy).toBe('external-mcp');
  const { request: sent } = await call<{ request: ChatRequest }>('send_message', {
    conversationId: conversation.id,
    content: 'Explain the role.',
  });
  const message = daemon.service.board.get<ChatMessage>('message', sent.messageId);
  expect(message.content).toBe('[External MCP agent]\nExplain the role.');
  const started = await waitForSnapshot(request, (snapshot) =>
    snapshot.runs.some((run) => run.requestId === sent.id),
  );
  const runId = started.runs.find((run) => run.requestId === sent.id)!.id;
  const snapshot = await finish(request, runId);
  const run = snapshot.runs.find((item) => item.id === runId)!;
  expect((await call<{ run: Run }>('read_run', { runId: run.id })).run.status).toBe('completed');
  const history = await call<{ items: unknown[] }>('read_conversation', {
    conversationId: conversation.id,
  });
  expect(JSON.stringify(history)).toContain('Explain the role.');
  expect(JSON.stringify(history)).not.toContain('configuration');
  daemon.service.board.updateCard(card.id, { owner: 'scout' }, 'system', 'Fixture lock');
  for (const [name, input] of [
    ['move_job', { state: 'offer' }],
    ['delete_job', {}],
    ['update_job', { changes: { title: 'Busy edit' } }],
  ] as const)
    expect(
      (
        await client.callTool({
          name: `pitchcrew_${name}`,
          arguments: { ...input, cardId: card.id, reason: 'Fixture' },
        })
      ).isError,
    ).toBe(true);
  daemon.service.board.updateCard(card.id, { owner: null }, 'system', 'Fixture unlock');
  daemon.service.board.record(
    'run',
    { ...run, status: 'running' },
    'system',
    'Fixture active chat',
  );
  expect(
    (
      await client.callTool({
        name: 'pitchcrew_move_job',
        arguments: { cardId: card.id, state: 'offer', reason: 'Busy chat check' },
      })
    ).isError,
  ).toBe(true);
  const queue = await call<{ queue: { queues: { runs: Record<string, unknown>[] }[] } }>(
    'read_queue',
  );
  for (const item of queue.queue.queues)
    for (const active of item.runs) expect(active).not.toHaveProperty('configuration');
  daemon.service.board.record('run', run, 'system', 'Fixture finished chat');
  await call('delete_job', { cardId: second.card.id, reason: 'Duplicate fixture' });
  expect(
    daemon.service.board
      .history(second.card.id)
      .some((event) => event.actor === 'external-mcp' && 'deletedAt' in event.data),
  ).toBe(true);
  expect(await readFile(join(directory, 'external-mcp.json'), 'utf8')).not.toContain(
    'Explain the role.',
  );
});

it('provides the stable read-only evidence for all ten example-workspace evaluation answers', async () => {
  const { daemon, directory } = await setup(15624);
  await daemon.service.loadExamples();
  await enableExternalAccess(directory);
  const client = await connect(directory, Number(new URL(daemon.url).port));
  const list = await client.callTool({ name: 'pitchcrew_list_jobs', arguments: { limit: 50 } });
  const jobs = (list.structuredContent as { items: { id: string }[] }).items;
  const cards: Card[] = [];
  for (const job of jobs) {
    const result = await client.callTool({
      name: 'pitchcrew_read_job',
      arguments: { cardId: job.id },
    });
    expect(result.isError).not.toBe(true);
    cards.push((result.structuredContent as { card: Card }).card);
  }
  const profile = await client.callTool({ name: 'pitchcrew_read_profile', arguments: {} });
  const source = (profile.structuredContent as { files: { content: string }[] }).files
    .map((file) => file.content)
    .join('\n');
  expect(source).toContain('profiling rendering');
  expect(source).toContain('reusable UI components');
  const answers = [
    cards.find((card) => card.state === 'lead')!.company,
    cards.find((card) => card.state === 'shortlisted')!.salary,
    cards.find((card) => card.state === 'in_review')!.company,
    cards.find((card) => card.state === 'agreed')!.title,
    cards.find((card) => card.state === 'awaiting_approval')!.company,
    cards.find((card) => card.state === 'interviewing')!.salary,
    String(
      cards.filter(
        (card) =>
          card.packet &&
          (card.fit ?? 0) >= 80 &&
          !['submitted', 'interviewing'].includes(card.state),
      ).length,
    ),
    cards
      .filter((card) => card.packet && card.salary.startsWith('$'))
      .sort(
        (a, b) =>
          Number(b.salary.split('–')[1].replace(/\D/g, '')) -
          Number(a.salary.split('–')[1].replace(/\D/g, '')),
      )[0]!.salary,
    String(
      cards.filter((card) => card.tags.includes('React') && card.location.startsWith('Remote'))
        .length,
    ),
    source.match(/^# (.+) \(example candidate\)/)![1],
  ];
  const evaluation = await readFile(
    new URL('./fixtures/external-evaluation.xml', import.meta.url),
    'utf8',
  );
  expect(answers).toEqual(
    [...evaluation.matchAll(/<answer>(.*?)<\/answer>/g)].map((match) => match[1]),
  );
});
