/** Real-runtime contract check; deliberately independent of Vitest's Node host. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Card, Role, Run, Snapshot } from '@pitchcrew/core';
import { renderArtifacts, verifyDocument } from '@pitchcrew/packet';
import { legacyTracker } from '../../../board/test/fixtures/legacy-tracker.ts';
import { packet } from '../../../board/test/fixtures/packet.ts';
import { createDaemon } from '../../../orchestrator/src/server.ts';
import { readAttachmentText } from '../../../orchestrator/src/crew/attachments/text.ts';
import { boundedPacketCheck } from '../../../orchestrator/src/packet-rules/check.ts';

assert.ok(process.versions.bun, 'This contract must execute in Bun, not a Node test host.');
process.env.PITCHCREW_POSTHOG_DISABLED = '1';
const reservation = createServer();
await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const address = reservation.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise<void>((resolve, reject) =>
  reservation.close((error) => (error ? reject(error) : resolve())),
);
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-bun-contract-'));
const daemon = await createDaemon({ directory, port, seedSkills: false, ui: false });
const client = new Client({ name: 'bun-runtime-contract', version: '1.0.0' });
const streamAbort = new AbortController();
let closed = false;
try {
  await new Promise<void>((resolve) => daemon.http.listen(port, '127.0.0.1', resolve));
  const page = await fetch(daemon.url);
  const cookie = page.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const headers = { cookie, 'x-pitchcrew-client': 'ui', 'content-type': 'application/json' };
  const request = (path: string, init: RequestInit = {}) =>
    fetch(`${daemon.url}/api${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
      signal: AbortSignal.timeout(15000),
    });
  assert.equal((await fetch(`${daemon.url}/api/snapshot`)).status, 403);
  const untrustedHeaders: Record<string, string>[] = [
    { host: 'localhost:' + port },
    { origin: 'https://example.invalid' },
    { 'sec-fetch-site': 'cross-site' },
  ];
  for (const extra of untrustedHeaders) {
    const denied = await request('/cards', { method: 'POST', headers: extra, body: '{' });
    assert.equal(denied.status, 403, 'Reject untrusted requests before parsing bodies.');
  }
  const initial = await request('/snapshot?view=workspace');
  assert.equal(initial.status, 200);
  const snapshot = (await initial.json()) as Snapshot;
  assert.equal(snapshot.roles.length, 8);
  const etag = initial.headers.get('etag');
  assert.ok(etag);
  assert.equal(
    (await request('/snapshot?view=workspace', { headers: { 'if-none-match': etag } })).status,
    304,
  );
  const stream = await fetch(`${daemon.url}/api/chat/stream?view=workspace`, {
    headers,
    signal: streamAbort.signal,
  });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = stream.body!.getReader();
  const first = await Promise.race([
    reader.read(),
    new Promise<never>((_, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Bun SSE did not flush its first event.')),
        5000,
      );
      timeout.unref();
    }),
  ]);
  assert.match(new TextDecoder().decode(first.value), /^data: /);
  streamAbort.abort();
  await reader.cancel().catch(() => {});
  const created = await request('/cards', {
    method: 'POST',
    body: JSON.stringify({ company: 'Bun fixture', title: 'Engineer' }),
  });
  assert.equal(created.status, 201);
  const card = (await created.json()) as Card;
  assert.equal(daemon.service.board.get<Card>('card', card.id).company, 'Bun fixture');
  assert.equal(
    (await request('/snapshot?view=workspace', { headers: { 'if-none-match': etag } })).status,
    200,
  );
  const text = await readAttachmentText(
    new TextEncoder().encode('Fictional candidate evidence.'),
    'text/plain',
    new AbortController().signal,
  );
  assert.match(text.text, /Fictional candidate evidence/);
  await assert.rejects(
    readAttachmentText(new Uint8Array(), 'text/plain', AbortSignal.abort()),
    /abort/i,
  );
  const source = join(directory, 'fictional-tracker.db');
  legacyTracker(source);
  const conversion = await request('/tracking/import/database', {
    method: 'POST',
    body: JSON.stringify({ content: (await readFile(source)).toString('base64') }),
  });
  assert.equal(conversion.status, 200, await conversion.clone().text());
  assert.equal(JSON.parse(((await conversion.json()) as { content: string }).content).length, 4);
  assert.equal(
    daemon.service.board.list('card').length,
    1,
    'Conversion must not import without confirmation.',
  );
  const [artifact] = await renderArtifacts(packet, ['docx'], 'plain', { sources: ['resume'] });
  const verification = await verifyDocument(artifact, packet.resume);
  assert.equal(verification.status, 'verified', JSON.stringify(verification));
  const rules = await boundedPacketCheck(packet, [], {
    version: 1,
    rules: [
      {
        id: 'fixture-pattern',
        kind: 'pattern',
        pattern: 'React',
        flags: '',
        severity: 'warn',
        documents: ['resume'],
        maxCount: 2,
      },
    ],
  });
  assert.ok(Array.isArray(rules.errors));
  daemon.service.board.record(
    'role',
    { ...daemon.service.board.get<Role>('role', 'writer'), enabled: true },
    'user',
    'Enable isolated fixture role',
  );
  daemon.service.capabilities.set('bun-contract-token', {
    runId: 'bun-contract',
    roleId: 'writer',
    cardId: card.id,
  });
  daemon.service.controllers.set('bun-contract', new AbortController());
  daemon.service.board.record(
    'run',
    {
      id: 'bun-contract',
      roleId: 'writer',
      cardId: card.id,
      mode: 'chat',
      runtime: 'codex',
      status: 'running',
      message: '',
      startedAt: new Date().toISOString(),
      finishedAt: null,
    } satisfies Run,
    'user',
    'Bun runtime contract',
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--no-env-file',
      '--no-install',
      fileURLToPath(new URL('../../src/cli.ts', import.meta.url)),
    ],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
      PITCHCREW_DAEMON_URL: daemon.url,
      PITCHCREW_RUN_TOKEN: 'bun-contract-token',
    },
    stderr: 'pipe',
  });
  transport.stderr?.on('data', (data) => process.stderr.write(data));
  await client.connect(transport);
  assert.ok((await client.listTools()).tools.some((tool) => tool.name === 'pitchcrew_get_card'));
  assert.notEqual(
    (await client.callTool({ name: 'pitchcrew_get_card', arguments: {} })).isError,
    true,
  );
  assert.equal(
    (
      await client.callTool({
        name: 'pitchcrew_export_packet',
        arguments: { approvalId: '00000000-0000-4000-8000-000000000001' },
      })
    ).isError,
    true,
    'Bun must preserve the exact-action approval gate.',
  );
  await client.close();
  daemon.service.controllers.delete('bun-contract');
  daemon.service.capabilities.delete('bun-contract-token');
  await daemon.close();
  closed = true;
  const reopened = await createDaemon({ directory, port, seedSkills: false, ui: false });
  try {
    assert.equal(reopened.service.board.get<Card>('card', card.id).company, 'Bun fixture');
  } finally {
    await reopened.close();
  }
  console.log(
    JSON.stringify({
      runtime: `Bun ${process.versions.bun}`,
      checks: [
        'SQLite persistence',
        'HTTP session/Host/Origin gates',
        'conditional snapshot',
        'SSE flush/disconnect',
        'Node-bounded attachment/database/document helpers',
        'MCP stdio',
        'unapproved export rejection',
      ],
    }),
  );
} finally {
  streamAbort.abort();
  await client.close();
  daemon.service.controllers.delete('bun-contract');
  daemon.service.capabilities.delete('bun-contract-token');
  if (!closed) await daemon.close();
  await rm(directory, { recursive: true, force: true });
}
