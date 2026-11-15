import { currentEventVersion, decodeEvent } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { Board } from '../src/index.ts';
import { laterEvents, versionTwoEvents } from './fixtures/historical-events.ts';

let board: Board | undefined;
afterEach(() => board?.close());

const fixtures = [...versionTwoEvents, ...laterEvents];
const insertAll = (target: Board) =>
  fixtures.map((fixture) => {
    const raw = JSON.stringify(fixture);
    const row = target.db.prepare('INSERT INTO events(json) VALUES (?)').run(raw);
    return { id: row.lastInsertRowid, raw, fixture };
  });
const stored = (target: Board, id: number | bigint) =>
  (target.db.prepare('SELECT json FROM events WHERE id = ?').get(id) as { json: string }).json;

it('decodes early-version events without injecting or dropping fields', () => {
  board = new Board(':memory:');
  for (const { raw, fixture } of insertAll(board)) {
    const decoded = decodeEvent(raw);
    expect(decoded.version).toBe(fixture.version);
    expect(decoded.data).toEqual(fixture.data);
  }
});

it('rebuilds every historical entity to its last saved shape', () => {
  board = new Board(':memory:');
  insertAll(board);
  board.rebuild();
  const last = new Map<string, (typeof fixtures)[number]>();
  for (const fixture of fixtures) last.set(`${fixture.kind}:${fixture.entityId}`, fixture);
  expect(last.size).toBeGreaterThan(10);
  for (const fixture of last.values())
    expect(board.get(fixture.kind as 'card', fixture.entityId)).toEqual(fixture.data);
});

it('lets the current board operate on old shapes and keeps old rows byte-identical', () => {
  board = new Board(':memory:');
  const rows = insertAll(board);
  board.rebuild();
  const moved = board.move('historic-card-lead', 'shortlisted', 'user');
  expect(moved.state).toBe('shortlisted');
  expect(board.events()[0].version).toBe(currentEventVersion);
  board.rebuild();
  expect(board.get<{ state: string }>('card', 'historic-card-lead').state).toBe('shortlisted');
  for (const row of rows) expect(stored(board, row.id)).toBe(row.raw);
});
