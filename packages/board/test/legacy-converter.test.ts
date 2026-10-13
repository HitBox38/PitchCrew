import type { Card } from '@pitchcrew/core';
import { legacyTracker } from './fixtures/legacy-tracker.ts';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, expect, it } from 'vitest';
import { Board, applyApplicationImport, previewApplicationImport } from '../src/index.ts';

const script = fileURLToPath(
  new URL('../../../scripts/convert-legacy-tracker.ts', import.meta.url),
);
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir(), 'pitchcrew-legacy-')))
      throw new Error('Refusing unsafe cleanup target.');
    await rm(directory, { recursive: true, force: true });
  }
});

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
      ['Data platform engineer', 'lead', expect.any(String)],
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
