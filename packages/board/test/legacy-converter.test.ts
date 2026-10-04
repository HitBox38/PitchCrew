import type { Card } from '@pitchcrew/core';
import Database from 'better-sqlite3';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { Board, applyApplicationImport, previewApplicationImport } from '../src/index.ts';

const script = fileURLToPath(
  new URL('../../../scripts/convert-legacy-tracker.mjs', import.meta.url),
);
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-legacy-')))
      throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
});
function legacyTracker(file: string) {
  const db = new Database(file);
  db.exec(`
CREATE TABLE applications (id INTEGER PRIMARY KEY, company TEXT NOT NULL, folder_path TEXT NOT NULL UNIQUE, role_title TEXT NOT NULL DEFAULT '', attempt INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'draft', weight INTEGER NOT NULL DEFAULT 0, lessons_learned TEXT, notes TEXT, applied_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(company, role_title, attempt));
CREATE TABLE status_events (id INTEGER PRIMARY KEY, application_id INTEGER NOT NULL, from_status TEXT, to_status TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE application_tags (application_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (application_id, tag_id));`);
  const app = db.prepare(
    'INSERT INTO applications (id, company, folder_path, role_title, attempt, status, weight, lessons_learned, notes, applied_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  );
  app.run(
    1,
    'Fictional Labs',
    'fictional-labs/frontend-engineer',
    'Frontend Engineer',
    1,
    'rejected',
    2,
    'Show the design system.',
    'Referral.',
    '2025-01-02T09:00:00+02:00',
    '2025-01-01 08:00:00',
    '2025-02-10 00:00:00',
  );
  app.run(
    2,
    'Fictional Labs',
    'fictional-labs/frontend-engineer/attempt-2',
    'Frontend Engineer',
    2,
    'interviewing',
    0,
    null,
    null,
    '2025-06-01 10:00:00',
    '2025-05-30 10:00:00',
    '2025-06-20 10:00:00',
  );
  app.run(
    3,
    'Example Works',
    'applications/example-works/data_platform-engineer',
    '',
    1,
    'draft',
    -1,
    null,
    null,
    null,
    '2025-04-01T00:00:00Z',
    '2025-04-01T00:00:00Z',
  );
  app.run(
    4,
    'Sample Co',
    'sample-co/2',
    '',
    1,
    'ghosted',
    0,
    null,
    null,
    null,
    '2025-03-01T00:00:00Z',
    '2025-04-01T00:00:00Z',
  );
  const event = db.prepare(
    'INSERT INTO status_events (application_id, from_status, to_status, note, created_at) VALUES (?,?,?,?,?)',
  );
  event.run(1, null, 'draft', null, '2025-01-01 08:00:00');
  event.run(1, 'draft', 'submitted', null, '2025-01-02T07:00:00Z');
  event.run(1, 'submitted', 'ghosted', 'Quiet for a month.', '2025-02-01T00:00:00Z');
  event.run(1, 'ghosted', 'rejected', null, '2025-02-10T00:00:00-05:00');
  event.run(2, null, 'submitted', null, '2025-06-01 10:00:00');
  event.run(2, 'submitted', 'interviewing', null, '2025-06-15 10:00:00');
  event.run(4, null, 'submitted', null, '2025-03-01T00:00:00Z');
  event.run(4, 'submitted', 'ghosted', null, '2025-04-01T00:00:00Z');
  const tag = db.prepare('INSERT INTO tags (id, name) VALUES (?, ?)');
  const link = db.prepare('INSERT INTO application_tags (application_id, tag_id) VALUES (?, ?)');
  for (let id = 1; id <= 12; id++) {
    tag.run(id, id === 12 ? `long-${'x'.repeat(45)}` : `tag-${String(id).padStart(2, '0')}`);
    link.run(1, id);
  }
  db.close();
}

it('converts a legacy SQLite tracker into an import file that previews and applies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-legacy-'));
  directories.push(directory);
  const source = join(directory, 'tracker.db');
  const output = join(directory, 'applications.json');
  legacyTracker(source);
  const { stderr } = await promisify(execFile)(process.execPath, [script, source, output]);
  expect(stderr).toContain('Converted 4 applications');
  expect(stderr).toContain('1 titles came from folder paths');
  const content = await readFile(output, 'utf8');
  const rows = JSON.parse(content) as Record<string, unknown>[];
  expect(rows[0]).toMatchObject({
    company: 'Fictional Labs',
    state: 'rejected',
    submittedAt: '2025-01-02T07:00:00.000Z',
    weight: 2,
    lessons: 'Show the design system.',
    notes: 'Referral.',
  });
  expect(rows[1]).toMatchObject({ attempt: 2, submittedAt: '2025-06-01T10:00:00.000Z' });
  expect(rows[2]).toMatchObject({ title: 'Data platform engineer', titleDerived: true });
  expect(rows[2]).not.toHaveProperty('statusAt');
  expect(rows[3]).toMatchObject({ title: '' });

  const board = new Board(':memory:');
  try {
    const request = { format: 'json', content };
    const preview = previewApplicationImport(board, request);
    expect(preview.rows.map((row) => row.status)).toEqual(['new', 'new', 'new', 'new']);
    expect(preview.rows[0].warnings.join(' ')).toContain('Kept the first 10 tags');
    expect(preview.rows[0].warnings.join(' ')).toContain('shortest valid path');
    expect(preview.rows[2].warnings.join(' ')).toContain('derived from the folder path');
    expect(preview.rows[3].warnings.join(' ')).toContain('Untitled role');
    const result = applyApplicationImport(board, { ...request, digest: preview.digest });
    expect(result.counts.created).toBe(4);
    const cards = board.list<Card>('card');
    expect(cards.map((card) => [card.title, card.state, card.statusEffectiveAt ?? null])).toEqual([
      ['Frontend Engineer', 'rejected', '2025-02-10T05:00:00.000Z'],
      ['Frontend Engineer (try 2)', 'interviewing', '2025-06-15T10:00:00.000Z'],
      ['Data platform engineer', 'lead', null],
      ['Untitled role', 'ghosted', '2025-04-01T00:00:00.000Z'],
    ]);
    expect(cards[0].tags).toHaveLength(10);
    expect(cards[0].tracking?.note).toContain('Legacy weight: 2');
    expect(cards[0].tracking?.note).toContain('ghosted at 2025-02-01T00:00:00.000Z: Quiet');
    expect(cards[2].tracking?.note).toContain('Legacy weight: -1');
    expect(
      applyApplicationImport(board, { ...request, digest: preview.digest }).counts.imported,
    ).toBe(4);
  } finally {
    board.close();
  }
});
