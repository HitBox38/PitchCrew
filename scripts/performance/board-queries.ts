/** Isolated, fictional SQLite query benchmark: node --import tsx scripts/performance/board-queries.ts */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardInput, type ChatMessage, type Role } from '../../packages/core/src/index.ts';
import { Board } from '../../packages/board/src/index.ts';
const message = (index: number): ChatMessage => {
  return {
    id: `message-${String((index * 7919) % 104729).padStart(8, '0')}`,
    threadId: 'scout',
    from: 'user',
    to: 'scout',
    content: `${content}\nMessage ${index}`,
    cardId: null,
    runId: null,
    createdAt: '2026-10-14T00:00:00.000Z',
  };
};
const timed = (action: () => unknown, setup = () => {}) => {
  setup();
  action(); // Warm prepared paths before collecting samples.
  const durations: number[] = [];
  for (let index = 0; index < samples; index++) {
    setup();
    const started = performance.now();
    action();
    durations.push(performance.now() - started);
  }
  const sorted = [...durations].sort((a, b) => a - b);
  return { samples: durations, median: sorted[Math.floor(samples / 2)], worst: sorted.at(-1) };
};
const measure = (board: Board) => {
  const listSql = 'SELECT json FROM entities WHERE kind = ? ORDER BY rowid';
  const historySql =
    "SELECT id,json FROM events WHERE json_extract(json,'$.entityId') = ? AND id < ? ORDER BY id DESC LIMIT ?";
  const roleSql =
    "SELECT json FROM events WHERE json_extract(json,'$.kind') = 'role' AND json_extract(json,'$.entityId') = ? ORDER BY id LIMIT 1";
  return {
    plans: {
      list: board.db.prepare(`EXPLAIN QUERY PLAN ${listSql}`).all('message'),
      history: board.db
        .prepare(`EXPLAIN QUERY PLAN ${historySql}`)
        .all('scout', Number.MAX_SAFE_INTEGER, 100),
      role: board.db.prepare(`EXPLAIN QUERY PLAN ${roleSql}`).all('scout'),
    },
    listRows: timed(() => board.db.prepare(listSql).all('message')),
    listParsed: timed(() => board.list('message')),
    history: timed(() => board.history('scout')),
    instructionStatuses: timed(
      () => board.defaultInstructionStatuses(),
      // Invalidate the cache as real writes do, excluding the write itself from read timing.
      () => {
        board.record('message', message(0), 'user', 'Fictional cache invalidation');
      },
    ),
  };
};

const samples = 7;
const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-board-queries-'));
const content =
  '## Fictional project update\n\n- Improved accessibility and performance.\n- Used TypeScript and SQLite.\n\n'.repeat(
    8,
  );
try {
  const results = [];
  for (const count of [5000, 25000]) {
    const filename = join(directory, `${count}.sqlite`);
    let board: Board | undefined = new Board(filename);
    try {
      board.db.transaction(() => {
        board!.seedRoles('claude-code', false);
        for (let index = 0; index < count / 10; index++)
          board!.createCard(cardInput.parse({ company: `Fictional ${index}`, title: 'Engineer' }));
        for (let index = 0; index < count; index++)
          board!.record('message', message(index), 'user', 'Fictional benchmark message');
      })();
      const role = board.get<Role>('role', 'writer');
      board.record(
        'role',
        { ...role, instructions: 'Customized fictional instructions.' },
        'user',
        'Fictional customization',
      );
      // These fixture-only drops reproduce the previous schema without modifying application data.
      board.db.exec('DROP INDEX entities_kind; DROP INDEX events_entity_id;');
      const before = measure(board);
      board.close();
      board = undefined;
      const started = performance.now();
      board = new Board(filename);
      const indexMigrationMs = performance.now() - started;
      const after = measure(board);
      results.push({ messages: count, cards: count / 10, indexMigrationMs, before, after });
    } finally {
      board?.close();
    }
  }
  console.log(JSON.stringify({ node: process.version, samples, results }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
