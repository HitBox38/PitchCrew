import type { ApplicationImportReport, Card, DatabaseImportConversion } from '@pitchcrew/core';
import Database from 'better-sqlite3';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { legacyTracker } from '../../board/test/fixtures/legacy-tracker.ts';
import { cleanup, setup } from './helpers/daemon.ts';

afterEach(cleanup);

it('converts an uploaded database locally, then previews and imports with user confirmation', async () => {
  const { daemon, directory, request } = await setup(15372);
  const source = join(directory, 'applications.db');
  legacyTracker(source);
  const original = await readFile(source);
  const body = { content: original.toString('base64') };
  const outside = await fetch(`${daemon.url}/api/tracking/import/database`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(outside.status).toBe(403);
  daemon.service.capabilities.set('database-import-token', {
    roleId: 'scout',
    cardId: null,
    runId: 'fixture',
  });
  const agent = await fetch(`${daemon.url}/api/tracking/import/database`, {
    method: 'POST',
    headers: { authorization: 'Bearer database-import-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(agent.status).toBe(403);
  daemon.service.capabilities.delete('database-import-token');
  const converted = await request<DatabaseImportConversion>(
    '/tracking/import/database',
    'POST',
    body,
  );
  expect(converted.response.status).toBe(200);
  expect(converted.result.warnings.join(' ')).toContain('UTC');
  expect(converted.result.warnings.join(' ')).toContain('folder names');
  expect(daemon.service.board.list('card')).toEqual([]);
  expect(await readFile(source)).toEqual(original);
  const upload = { format: 'json', content: converted.result.content };
  const preview = await request<ApplicationImportReport>(
    '/tracking/import/preview',
    'POST',
    upload,
  );
  expect(preview.result.counts).toMatchObject({ new: 4, invalid: 0 });
  expect(daemon.service.board.list('card')).toEqual([]);
  const applied = await request<ApplicationImportReport>('/tracking/import/apply', 'POST', {
    ...upload,
    digest: preview.result.digest,
  });
  expect(applied.result.counts.created).toBe(4);
  const cards = daemon.service.board.list<Card>('card');
  expect(cards[0]).toMatchObject({ company: 'Fictional Labs', state: 'rejected', weight: 2 });
  expect(cards[1].title).toContain('try 2');
  expect(daemon.service.board.list('approval')).toEqual([]);
  const retry = await request<ApplicationImportReport>('/tracking/import/apply', 'POST', {
    ...upload,
    digest: preview.result.digest,
  });
  expect(retry.result.counts).toMatchObject({ imported: 4, created: 0 });
});

it('rejects invalid, oversized, unsupported and excessive-row databases with usable errors', async () => {
  const { directory, request } = await setup(15373);
  const convert = (content: string) =>
    request<{ error: string }>('/tracking/import/database', 'POST', { content });
  expect((await convert(Buffer.from('not sqlite').toString('base64'))).result.error).toContain(
    'not a SQLite',
  );
  expect((await convert('%%%')).response.status).toBe(400);
  const db = new Database(':memory:');
  db.exec('CREATE TABLE unrelated (id INTEGER)');
  const unsupported = await convert(db.serialize().toString('base64'));
  db.close();
  expect(unsupported.response.status).toBe(400);
  expect(unsupported.result.error).toContain('not a supported application tracker');
  expect(
    (await convert(Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64'))).response.status,
  ).toBe(400);
  const source = join(directory, 'many.db');
  legacyTracker(source);
  const many = new Database(source);
  many.exec(`WITH RECURSIVE n(x) AS (SELECT 10 UNION ALL SELECT x+1 FROM n WHERE x<1010)
    INSERT INTO applications (id,company,folder_path,role_title,created_at,updated_at)
    SELECT x, 'Example '||x, 'example/'||x, 'Engineer', '2025-01-01', '2025-01-01' FROM n`);
  many.close();
  const excessive = await convert((await readFile(source)).toString('base64'));
  expect(excessive.result.error).toContain('at most 1000');
});
