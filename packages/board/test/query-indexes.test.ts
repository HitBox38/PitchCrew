import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardInput, type ChatMessage, type Role } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { Board, deleteJob } from '../src/index.ts';

const boards = new Set<Board>();
const directories: string[] = [];
function open(filename = ':memory:') {
  const board = new Board(filename);
  boards.add(board);
  return board;
}
function close(board: Board) {
  board.close();
  boards.delete(board);
}
async function filename() {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-query-indexes-'));
  directories.push(directory);
  return join(directory, 'board.sqlite');
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const board of boards) board.close();
  boards.clear();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});
function message(id: string, content = id): ChatMessage {
  return {
    id,
    content,
    threadId: 'scout',
    from: 'user',
    to: 'scout',
    cardId: null,
    runId: null,
    createdAt: '',
  };
}
function plansFor(board: Board, action: () => unknown) {
  const prepare = vi.spyOn(board.db, 'prepare');
  action();
  const queries = prepare.mock.calls.map(([sql]) => sql);
  prepare.mockRestore();
  return queries
    .filter((sql) => /WHERE (?:kind = \?|json_extract)/.test(sql))
    .map((sql) => {
      const parameters = sql.includes('FROM entities')
        ? ['message']
        : sql.includes('id < ?')
          ? ['scout', Number.MAX_SAFE_INTEGER, 100]
          : ['scout'];
      const plan = board.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...parameters) as {
        detail: string;
      }[];
      return { sql, details: plan.map(({ detail }) => detail).join('\n') };
    });
}

it('keeps insertion order through updates, reopen and projection rebuild', async () => {
  const path = await filename();
  let board = open(path);
  for (const id of ['z-last-alphabetically', 'a-first-alphabetically', 'm-middle'])
    board.record('message', message(id), 'user', 'Created');
  board.record('message', message('z-last-alphabetically', 'Edited'), 'user', 'Edited');
  const expected = board.list<ChatMessage>('message');
  expect(expected.map(({ id }) => id)).toEqual([
    'z-last-alphabetically',
    'a-first-alphabetically',
    'm-middle',
  ]);
  expect(expected[0].content).toBe('Edited');
  close(board);
  board = open(path);
  expect(board.list('message')).toEqual(expected);
  const events = board.events();
  board.rebuild();
  expect(board.list('message')).toEqual(expected);
  expect(board.events()).toEqual(events);
});

it('preserves surviving card order after updates and tombstones, including rebuild', () => {
  const board = open();
  const cards = ['First', 'Deleted', 'Last'].map((company) =>
    board.createCard(cardInput.parse({ company, title: 'Engineer' })),
  );
  board.updateCard(cards[0].id, { fit: 90 }, 'scout', 'Updated');
  deleteJob(board, cards[1].id, 'user', 'Deleted fixture');
  const appended = board.createCard(cardInput.parse({ company: 'Appended', title: 'Engineer' }));
  const expected = [cards[0].id, cards[2].id, appended.id];
  expect(board.list<{ id: string }>('card').map(({ id }) => id)).toEqual(expected);
  const history = board.history(cards[1].id);
  board.rebuild();
  expect(board.list<{ id: string }>('card').map(({ id }) => id)).toEqual(expected);
  expect(board.history(cards[1].id)).toEqual(history);
});

it('upgrades an existing schema without changing events, rowids or append-only enforcement', async () => {
  const path = await filename();
  let board = open(path);
  board.db.exec('DROP INDEX entities_kind; DROP INDEX events_entity_id;');
  for (const id of ['z', 'a']) board.record('message', message(id), 'user', 'Legacy fixture');
  const events = board.db.prepare('SELECT id,json FROM events ORDER BY id').all();
  const entities = board.db.prepare('SELECT rowid,* FROM entities ORDER BY rowid').all();
  close(board);
  board = open(path);
  expect(board.db.prepare('SELECT id,json FROM events ORDER BY id').all()).toEqual(events);
  expect(board.db.prepare('SELECT rowid,* FROM entities ORDER BY rowid').all()).toEqual(entities);
  expect(plansFor(board, () => board.list('message'))[0].details).toContain(
    'USING INDEX entities_kind',
  );
  expect(() => board.db.exec('DELETE FROM events')).toThrow('append-only');
  expect(() => board.db.exec("UPDATE events SET json = '{}' ")).toThrow('append-only');
  close(board);
  board = open(path);
  expect(board.list<ChatMessage>('message').map(({ id }) => id)).toEqual(['z', 'a']);
});

it('uses indexed, sort-free plans at the list, history and default-instruction seams', () => {
  const board = open();
  board.seedRoles('claude-code', false);
  const role = board.get<Role>('role', 'scout');
  board.record(
    'role',
    { ...role, instructions: 'Customized fixture instructions.' },
    'user',
    'Edited',
  );
  const plans = [
    ...plansFor(board, () => board.list('message')),
    ...plansFor(board, () => board.history('scout')),
    ...plansFor(board, () => board.defaultInstructionStatuses()),
  ];
  expect(plans.filter(({ sql }) => sql.includes('FROM events')).length).toBeGreaterThan(2);
  for (const { sql, details } of plans) {
    expect(details, sql).not.toContain('TEMP B-TREE');
    expect(details, sql).toContain(
      sql.includes('FROM entities') ? 'USING INDEX entities_kind' : 'USING INDEX events_entity_id',
    );
  }
  expect(board.history('scout').map(({ message }) => message)).toEqual([
    'Edited',
    'Initialized Scout',
  ]);
});
