import { cardInput, currentEventVersion, decodeEvent, type Card } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import {
  Board,
  addCardLesson,
  applyApplicationImport,
  mergeTags,
  previewApplicationImport,
  setCardWeight,
} from '../src/index.ts';

let board: Board | undefined;
afterEach(() => board?.close());
it('retains mixed v9 imports, both v10 payload families, and combined v11 snapshots byte for byte', () => {
  board = new Board(':memory:');
  const template = board.createCard(
    cardInput.parse({ company: 'Fictional Replay', title: 'Engineer', tags: ['legacy'] }),
  );
  const input = {
    format: 'json',
    content: JSON.stringify([
      {
        company: 'Old Import',
        title: 'Engineer',
        state: 'rejected',
        submittedAt: '2025-01-01',
        weight: -1,
        lessons: 'Past tracker note.',
      },
    ]),
  };
  const preview = previewApplicationImport(board, input);
  const imported: Card = {
    ...template,
    id: 'old-import',
    company: 'Old Import',
    state: 'rejected',
    statusEffectiveAt: '2025-01-01T00:00:00.000Z',
    tracking: {
      origin: 'external',
      submittedAt: '2025-01-01T00:00:00.000Z',
      jobIdentifier: '',
      gmailThreads: [],
      note: 'Imported from a past tracker.\nLegacy weight: -1\nLegacy lessons: Past tracker note.',
    },
  };
  const discovery: Card = {
    ...template,
    id: 'old-discovery',
    discovery: {
      provider: 'lever',
      sourceId: 'fictional',
      sourceName: 'Fictional Replay',
      slug: 'fictional',
      jobId: 'role-1',
      firstSeenAt: template.createdAt,
      postedAt: null,
    },
  };
  const learned: Card = {
    ...template,
    id: 'old-learning',
    weight: 2,
    lessons: [{ id: 'old-lesson', text: 'Prerelease learning.', createdAt: template.createdAt }],
  };
  const fixtures = [
    {
      version: 9,
      data: imported,
      message: `Imported a past application (import key ${preview.rows[0].key}); registered a known external submission, no outward action`,
    },
    { version: 10, data: discovery, message: 'Discovered a fictional role' },
    { version: 10, data: learned, message: 'Saved prerelease learning' },
  ];
  const retained = fixtures.map((fixture) => {
    const raw = JSON.stringify({ ...board!.events()[0], ...fixture, entityId: fixture.data.id });
    const row = board!.db.prepare('INSERT INTO events(json) VALUES (?)').run(raw);
    expect(decodeEvent(raw).data).toEqual(fixture.data);
    return { id: row.lastInsertRowid, raw };
  });
  board.rebuild();
  for (const fixture of fixtures)
    expect(board.get<Card>('card', fixture.data.id)).toEqual(fixture.data);
  const previousCount = board.events().length;
  expect(applyApplicationImport(board, { ...input, digest: preview.digest }).rows[0].status).toBe(
    'imported',
  );
  expect(board.events()).toHaveLength(previousCount);
  expect(board.get<Card>('card', imported.id).weight).toBeUndefined();
  expect(board.get<Card>('card', imported.id).lessons).toBeUndefined();
  setCardWeight(board, discovery.id, { weight: -2 });
  addCardLesson(board, discovery.id, { text: 'Discovery and learning coexist.' });
  mergeTags(board, { from: 'legacy', to: 'current' });
  const combined = board.get<Card>('card', discovery.id);
  expect(combined).toMatchObject({ discovery: discovery.discovery, weight: -2, tags: ['current'] });
  expect(combined.lessons?.[0].text).toBe('Discovery and learning coexist.');
  expect(board.events()[0].version).toBe(currentEventVersion);
  board.rebuild();
  expect(board.get<Card>('card', discovery.id)).toEqual(combined);
  expect(board.get<Card>('card', imported.id).tracking).toEqual(imported.tracking);
  expect(board.get<Card>('card', learned.id).lessons).toEqual(learned.lessons);
  for (const fixture of retained)
    expect(
      (board.db.prepare('SELECT json FROM events WHERE id = ?').get(fixture.id) as { json: string })
        .json,
    ).toBe(fixture.raw);
  expect(() => decodeEvent('{"version":12}')).toThrow('Unsupported');
});
