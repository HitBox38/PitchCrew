import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardInput, type AgentTask, type ChatMessage, type Role, type Run } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import {
  Board,
  deleteJob,
  findRun,
  runHeaders,
  runsForCard,
  runsForDeepReview,
  runsForThread,
  runsWithStatus,
  tasksWithStatus,
} from '../src/index.ts';
const open = (filename = ':memory:') => {
  const board = new Board(filename);
  boards.add(board);
  return board;
};
const close = (board: Board) => {
  board.close();
  boards.delete(board);
};
const filename = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-query-indexes-'));
  directories.push(directory);
  return join(directory, 'board.sqlite');
};

const message = (id: string, content = id): ChatMessage => {
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
};
const plansFor = (board: Board, action: () => unknown) => {
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
};

const boards = new Set<Board>();
const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const board of boards) board.close();
  boards.clear();
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

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

const run = (id: string, patch: Partial<Run>): Run => ({
  id,
  cardId: null,
  roleId: 'writer',
  runtime: 'demo',
  status: 'completed',
  message: '',
  startedAt: '',
  finishedAt: null,
  ...patch,
});
const queryPlan = (board: Board, sql: string, ...parameters: unknown[]) =>
  (board.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...parameters) as { detail: string }[])
    .map(({ detail }) => detail)
    .join('\n');

it('selects runs and tasks through indexes, in projection order, without full-table parsing', () => {
  const board = open();
  const configuration = {
    role: { id: 'writer' } as Role,
    revision: 'r',
    skills: [],
    skillsRevision: 's',
  };
  board.record(
    'run',
    run('b', { cardId: 'card-1', status: 'running', threadId: 'writer' }),
    'writer',
    'Started',
  );
  board.record(
    'run',
    run('a', { cardId: 'card-2', status: 'waiting', deepReviewId: 'review-1' }),
    'writer',
    'Started',
  );
  board.record(
    'run',
    run('c', { cardId: 'card-1', threadId: 'writer', rootRunId: 'b', configuration }),
    'writer',
    'Started',
  );
  // An update keeps its projection position.
  board.record(
    'run',
    run('b', { cardId: 'card-1', status: 'running', threadId: 'writer', message: 'Edited' }),
    'writer',
    'Edited',
  );
  for (const [id, status] of [
    ['t2', 'queued'],
    ['t1', 'running'],
    ['t3', 'completed'],
  ] as const)
    board.record('task', { id, status, rootRunId: 'b' } as AgentTask, 'writer', 'Queued');

  const ids = (runs: { id: string }[]) => runs.map(({ id }) => id);
  expect(ids(runsWithStatus(board, ['running', 'waiting']))).toEqual(['b', 'a']);
  expect(runsWithStatus(board, ['running'])[0].message).toBe('Edited');
  expect(runsWithStatus(board, [])).toEqual([]);
  expect(ids(tasksWithStatus(board, ['queued', 'running']))).toEqual(['t2', 't1']);
  expect(ids(runsForCard(board, 'card-1'))).toEqual(['b', 'c']);
  expect(ids(runsForThread(board, 'writer'))).toEqual(['b', 'c']);
  expect(ids(runsForDeepReview(board, 'review-1'))).toEqual(['a']);
  expect(findRun(board, 'c')?.configuration?.revision).toBe('r');
  expect(findRun(board, 'missing')).toBeUndefined();
  const headers = runHeaders(board, ['c', 'c', 'missing']);
  expect([...headers.keys()]).toEqual(['c']);
  expect(headers.get('c')).toMatchObject({ rootRunId: 'b' });
  expect(headers.get('c')).not.toHaveProperty('configuration');

  // The SQL each helper actually prepares, planned with representative parameters.
  const planOf = (action: () => unknown, ...parameters: unknown[]) => {
    const prepare = vi.spyOn(board.db, 'prepare');
    action();
    const [sql] = prepare.mock.calls.map(([query]) => query);
    prepare.mockRestore();
    return queryPlan(board, sql, ...parameters);
  };
  expect(
    planOf(() => runsWithStatus(board, ['running', 'waiting']), 'running', 'waiting'),
  ).toContain('USING INDEX entities_queue_status');
  expect(planOf(() => tasksWithStatus(board, ['queued']), 'queued')).toContain(
    'USING INDEX entities_queue_status',
  );
  expect(planOf(() => runsForCard(board, 'x'), 'x')).toContain('USING INDEX entities_run_card');
  expect(planOf(() => runsForThread(board, 'x'), 'x')).toContain('USING INDEX entities_thread');
  expect(planOf(() => runsForDeepReview(board, 'x'), 'x')).toContain(
    'USING INDEX entities_run_review',
  );
});
