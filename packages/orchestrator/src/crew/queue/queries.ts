import type { AgentTask, Run } from '@pitchcrew/core';
import type { CrewContext } from '../types.ts';

/** Terminal runs remain active while their controller owns asynchronous cleanup. */
export const activeRuns = (context: CrewContext): Run[] => {
  const rows = context.board.db
    .prepare(
      `SELECT rowid AS position,json FROM entities
        WHERE kind='run' AND json_extract(json,'$.status')='running'`,
    )
    .all() as { position: number; json: string }[];
  const selected = new Map(rows.map((row) => [row.position, row]));
  const owned = context.board.db.prepare(
    "SELECT rowid AS position,json FROM entities WHERE kind='run' AND id=?",
  );
  for (const id of context.controllers.keys()) {
    const row = owned.get(id) as { position: number; json: string } | undefined;
    if (row) selected.set(row.position, row);
  }
  return [...selected.values()]
    .sort((a, b) => a.position - b.position)
    .map((row) => JSON.parse(row.json) as Run);
};

/** Select lifecycle states in SQLite before deserializing potentially large historical payloads. */
export const tasksWithStatus = (
  context: CrewContext,
  statuses: AgentTask['status'][],
): AgentTask[] => {
  const rows = context.board.db
    .prepare(
      `SELECT rowid AS position,json FROM entities WHERE kind='task'
        AND json_extract(json,'$.status') IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(statuses)) as { position: number; json: string }[];
  // Ordering in SQL can make SQLite choose a whole-kind scan over the status index.
  return rows
    .sort((a, b) => a.position - b.position)
    .map((row) => JSON.parse(row.json) as AgentTask);
};
