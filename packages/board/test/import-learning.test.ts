import { currentEventVersion, type Card } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import {
  Board,
  applyApplicationImport,
  boardInsights,
  previewApplicationImport,
} from '../src/index.ts';

const boards: Board[] = [];
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
function create() {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
}
function request(lessons = 'Lead with platform work.', weight = 2) {
  return {
    format: 'json',
    content: JSON.stringify([
      {
        company: 'Fictional Import Labs',
        title: 'Engineer',
        state: 'rejected',
        submittedAt: '2025-01-01',
        statusAt: '2025-02-01',
        weight,
        lessons,
        tags: ['remote'],
      },
    ]),
  };
}
it('imports structured signals into historical Insights and replays without changing retry keys', () => {
  const board = create();
  const input = request();
  const preview = previewApplicationImport(board, input);
  const result = applyApplicationImport(board, { ...input, digest: preview.digest });
  const card = board.get<Card>('card', result.rows[0].cardIds[0]);
  expect(card.weight).toBe(2);
  expect(card.lessons?.map((lesson) => lesson.text)).toEqual(['Lead with platform work.']);
  expect(card.tracking?.note).toContain('Legacy lessons: Lead with platform work.');
  expect(card.tracking?.note).toContain('Legacy weight: 2');
  expect(card.statusEffectiveAt).toBe('2025-02-01T00:00:00.000Z');
  const insights = boardInsights(board, {
    from: '2025-01-01T00:00:00Z',
    to: '2025-01-02T00:00:00Z',
  });
  expect(insights.outcomes.negative).toBe(1);
  expect(insights.weights.find((value) => value.weight === 2)?.count).toBe(1);
  expect(insights.lessons.negative[0]).toMatchObject({
    text: 'Lead with platform work.',
    cardId: card.id,
  });
  const raw = board.db.prepare('SELECT json FROM events ORDER BY id').all();
  board.rebuild();
  expect(board.get<Card>('card', card.id)).toEqual(card);
  expect(
    boardInsights(board, { from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' }),
  ).toEqual(insights);
  expect(applyApplicationImport(board, { ...input, digest: preview.digest }).rows[0].status).toBe(
    'imported',
  );
  expect(board.db.prepare('SELECT json FROM events ORDER BY id').all()).toEqual(raw);
  expect(board.events().every((event) => event.version === currentEventVersion)).toBe(true);
});
it('splits long Unicode lessons into bounded notes and warns before applying', () => {
  const board = create();
  const text = `${'x'.repeat(999)}😀${'y'.repeat(999)}`;
  const input = request(text, 0);
  const preview = previewApplicationImport(board, input);
  expect(preview.rows[0].warnings.join(' ')).toContain('Split legacy lessons');
  const result = applyApplicationImport(board, { ...input, digest: preview.digest });
  const card = board.get<Card>('card', result.rows[0].cardIds[0]);
  expect(card.weight).toBe(0);
  const notes = card.lessons!.map((lesson) => lesson.text);
  expect(notes.join('')).toBe(text);
  expect(notes.every((note) => note.length <= 1000 && !/\p{Surrogate}/u.test(note))).toBe(true);
  expect(card.tracking?.note).toContain(text);
});
