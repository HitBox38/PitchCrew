import { currentEventVersion } from '@pitchcrew/core';
import { cardInput, decodeEvent, type Card, type Run, type TrackingSignal } from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCardLesson,
  Board,
  boardInsights,
  markStaleSubmissions,
  mergeTags,
  registerExternalApplication,
  removeCardLesson,
  setCardWeight,
  staleSubmissions,
  trackingConflict,
} from '../src/index.ts';

const day = 24 * 60 * 60 * 1000;
const boards: Board[] = [];
function create() {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
}
afterEach(() => {
  vi.useRealTimers();
  for (const board of boards.splice(0)) board.close();
});
function lead(board: Board, company: string, tags: string[] = []) {
  return board.createCard(cardInput.parse({ company, title: 'Fictional Engineer', tags }));
}
function external(board: Board, company: string, submittedAt: string) {
  return registerExternalApplication(board, {
    company,
    title: 'Fictional Engineer',
    submittedAt,
    note: 'Confirmed on a fictional careers page.',
  });
}

describe('current learning events', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9] as const)(
    'retains version %i card events unchanged on replay',
    (version) => {
      const board = create();
      const card = lead(board, 'Legacy Fictional Labs', ['Remote']);
      const legacy = { ...board.events()[0], version };
      const raw = JSON.stringify(legacy);
      const retained = board.db.prepare('INSERT INTO events(json) VALUES (?)').run(raw);
      board.rebuild();
      expect(board.get<Card>('card', card.id)).toEqual(card);
      expect(board.events()[0].version).toBe(version);
      expect(boardInsights(board, {}).weights.find((item) => item.weight === 0)?.count).toBe(1);
      expect(boardInsights(board, {}).lessons.pending).toEqual([]);
      setCardWeight(board, card.id, { weight: 1 });
      board.rebuild();
      expect(board.get<Card>('card', card.id).weight).toBe(1);
      expect(
        (
          board.db
            .prepare('SELECT json FROM events WHERE id = ?')
            .get(retained.lastInsertRowid) as { json: string }
        ).json,
      ).toBe(raw);
    },
  );
  it('appends weights and lessons as current-version card events that replay with older versions', () => {
    const board = create();
    const card = lead(board, 'Juniper Analytics', ['React']);
    // A retained v9 card event without the new fields still decodes and replays.
    const legacy = { ...board.events()[0], version: 9 };
    board.db.prepare('INSERT INTO events(json) VALUES (?)').run(JSON.stringify(legacy));
    setCardWeight(board, card.id, { weight: 2 });
    const withLesson = addCardLesson(board, card.id, { text: '  Lead with platform work.  ' });
    const events = board.events();
    expect(events[0]).toMatchObject({ version: currentEventVersion, kind: 'card', actor: 'user' });
    expect(events.find((event) => event.version === 9)).toBeDefined();
    expect(withLesson.lessons).toEqual([
      { id: expect.any(String), text: 'Lead with platform work.', createdAt: expect.any(String) },
    ]);
    board.rebuild();
    expect(board.get<Card>('card', card.id)).toEqual(withLesson);
    expect(decodeEvent(JSON.stringify(events[0])).version).toBe(currentEventVersion);
    expect(boardInsights(board, {}).weights.find((item) => item.weight === 2)?.count).toBe(1);
  });
  it('validates weights and caps lesson count and length', () => {
    const board = create();
    const card = lead(board, 'Quill Systems');
    for (const weight of [-3, 3, 1.5, '1']) {
      expect(() => setCardWeight(board, card.id, { weight })).toThrow();
    }
    expect(() => addCardLesson(board, card.id, { text: '   ' })).toThrow();
    expect(() => addCardLesson(board, card.id, { text: 'x'.repeat(1001) })).toThrow();
    for (let index = 0; index < 20; index++)
      addCardLesson(board, card.id, { text: `Fictional lesson ${index}` });
    expect(() => addCardLesson(board, card.id, { text: 'One more' })).toThrow('at most 20');
    const first = board.get<Card>('card', card.id).lessons![0];
    const removed = removeCardLesson(board, card.id, first.id);
    expect(removed.lessons).toHaveLength(19);
    expect(() => removeCardLesson(board, card.id, first.id)).toThrow('not found');
    // History keeps the removed lesson in its earlier event.
    expect(
      board
        .history(card.id)
        .some((event) => (event.data as Card).lessons?.some((item) => item.id === first.id)),
    ).toBe(true);
  });
});

describe('tag merge', () => {
  it('moves every card case-insensitively, deduplicates and stays within 10 tags', () => {
    const board = create();
    const full = lead(board, 'Harbor Freight Labs', [
      'reactjs',
      'React',
      ...Array.from({ length: 8 }, (_, index) => `tag-${index}`),
    ]);
    const only = lead(board, 'Pebble Works', ['ReactJS', 'Remote']);
    const untouched = lead(board, 'Oakline Studio', ['Go']);
    const before = board.events().length;
    const result = mergeTags(board, { from: 'ReactJS', to: 'React' });
    expect(result.cards.map((card) => card.id).sort()).toEqual([full.id, only.id].sort());
    const merged = board.get<Card>('card', full.id);
    expect(merged.tags).toHaveLength(9);
    expect(merged.tags[0]).toBe('React');
    expect(merged.tags.filter((tag) => tag.toLowerCase() === 'react')).toHaveLength(1);
    expect(board.get<Card>('card', only.id).tags).toEqual(['React', 'Remote']);
    expect(board.get<Card>('card', untouched.id).tags).toEqual(['Go']);
    expect(board.events().length).toBe(before + 2);
    expect(board.events()[0]).toMatchObject({ actor: 'user', version: currentEventVersion });
    const tenth = lead(
      board,
      'Mosaic Labs',
      Array.from({ length: 10 }, (_, i) => `t${i}`),
    );
    mergeTags(board, { from: 't0', to: 'Brand new' });
    expect(board.get<Card>('card', tenth.id).tags).toHaveLength(10);
    expect(() => mergeTags(board, { from: 'Missing', to: 'React' })).toThrow('No application');
    expect(() => mergeTags(board, { from: 'React', to: 'React' })).toThrow('different');
    expect(() => mergeTags(board, { from: 'React', to: 'x'.repeat(41) })).toThrow();
  });
});

describe('stale submission cleanup', () => {
  it('previews and applies stale submissions with effective times and history notes', () => {
    const board = create();
    const now = Date.now();
    const old = external(board, 'Lantern Health', new Date(now - 30 * day).toISOString());
    const recent = external(board, 'Mosaic Labs', new Date(now - 5 * day).toISOString());
    const preview = staleSubmissions(board, undefined, now);
    expect(preview.days).toBe(21);
    expect(preview.cards.map((card) => card.id)).toEqual([old.id]);
    expect(preview.cards[0]).toMatchObject({
      since: old.statusEffectiveAt,
      staleAt: new Date(Date.parse(old.statusEffectiveAt!) + 21 * day).toISOString(),
      idleDays: 30,
      blocked: '',
    });
    expect(staleSubmissions(board, '40', now).cards).toEqual([]);
    expect(staleSubmissions(board, '3', now).cards.map((card) => card.id)).toContain(recent.id);
    expect(() => staleSubmissions(board, '0', now)).toThrow();
    const [ghosted] = markStaleSubmissions(board, {
      days: 21,
      note: 'No reply from the fictional recruiter',
      cards: [{ id: old.id, updatedAt: old.updatedAt }],
    });
    expect(ghosted).toMatchObject({
      state: 'ghosted',
      statusEffectiveAt: preview.cards[0].staleAt,
    });
    expect(board.events()[0]).toMatchObject({
      actor: 'user',
      version: currentEventVersion,
      message:
        'Marked as no response after 21 days without a status change: No reply from the fictional recruiter',
    });
    expect(board.get<Card>('card', recent.id).state).toBe('submitted');
    // A reply dated after the silence period can still move the card forward.
    const later = {
      state: 'screening',
      effectiveAt: new Date(now - 2 * day).toISOString(),
    } as TrackingSignal;
    expect(trackingConflict(board, later, ghosted)).toBe('');
    const earlier = { ...later, effectiveAt: new Date(now - 20 * day).toISOString() };
    expect(trackingConflict(board, earlier, ghosted)).toContain('Older');
  });
  it('rejects changed, recent, non-submitted and actively owned cards', () => {
    const board = create();
    const now = Date.now();
    const card = external(board, 'Quill Systems', new Date(now - 40 * day).toISOString());
    const other = external(board, 'Oakline Studio', new Date(now - 40 * day).toISOString());
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now + 1000);
    const changed = setCardWeight(board, card.id, { weight: -1 });
    expect(() =>
      markStaleSubmissions(board, { cards: [{ id: card.id, updatedAt: card.updatedAt }] }),
    ).toThrow('changed since the preview');
    expect(() =>
      markStaleSubmissions(board, {
        days: 60,
        cards: [{ id: card.id, updatedAt: changed.updatedAt }],
      }),
    ).toThrow('status change in the last 60 days');
    expect(() =>
      markStaleSubmissions(board, {
        cards: [
          { id: card.id, updatedAt: changed.updatedAt },
          { id: card.id, updatedAt: changed.updatedAt },
        ],
      }),
    ).toThrow('once');
    board.record(
      'run',
      { id: 'fixture-run', cardId: other.id, status: 'running', mode: 'workflow' } as Run,
      'scout',
      'Fixture active run',
    );
    expect(
      staleSubmissions(board, 21, now).cards.find((item) => item.id === other.id),
    ).toMatchObject({ blocked: 'Application has active workflow work.' });
    expect(() =>
      markStaleSubmissions(board, {
        cards: [
          { id: card.id, updatedAt: changed.updatedAt },
          { id: other.id, updatedAt: other.updatedAt },
        ],
      }),
    ).toThrow('active workflow work');
    // The failed batch changed nothing.
    expect(board.get<Card>('card', card.id).state).toBe('submitted');
    const leadCard = lead(board, 'Pebble Works');
    expect(() =>
      markStaleSubmissions(board, { cards: [{ id: leadCard.id, updatedAt: leadCard.updatedAt }] }),
    ).toThrow('Only submitted');
  });
  it('uses the time a non-user actor moved a card into submitted when no user time exists', () => {
    const board = create();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const card = lead(board, 'Northwind Labs');
    for (const state of ['shortlisted', 'drafting', 'in_review', 'agreed', 'awaiting_approval'])
      board.move(card.id, state as Card['state'], 'demo');
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    board.move(card.id, 'submitted', 'demo', 'Fictional example submission');
    vi.setSystemTime(new Date('2026-02-15T00:00:00Z'));
    board.updateCard(card.id, { fit: 70 }, 'scout', 'Unrelated later edit');
    const preview = staleSubmissions(board, 21, Date.parse('2026-03-01T00:00:00Z'));
    expect(preview.cards[0]).toMatchObject({
      id: card.id,
      since: '2026-02-01T00:00:00.000Z',
      staleAt: '2026-02-22T00:00:00.000Z',
    });
    expect(staleSubmissions(board, 21, Date.parse('2026-02-20T00:00:00Z')).cards).toEqual([]);
  });
});
