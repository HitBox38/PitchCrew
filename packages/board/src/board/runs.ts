import type { AgentTask, Run } from '@pitchcrew/core';
import type Database from 'better-sqlite3';

/**
 * Indexed run and task lookups. Every historical run row carries its frozen role and skill
 * snapshot, so hot paths select matching rows in SQLite before parsing instead of listing the
 * whole table. Each `kind` stays a literal so the partial expression indexes in `context.ts`
 * apply. Multi-row results keep the projection (rowid) order that `list` uses.
 */
interface Queryable {
  readonly db: Database.Database;
}
type Status = Run['status'] | AgentTask['status'];

const parse = <T>(rows: unknown[]): T[] =>
  (rows as { json: string }[]).map((row) => JSON.parse(row.json) as T);
const placeholders = (values: readonly unknown[]) => values.map(() => '?').join(',');
// `+rowid` keeps the planner on the status index: with an IN list it otherwise prefers walking
// the kind index in rowid order, evaluating the status of every row.
const withStatus = <T>(board: Queryable, kind: 'run' | 'task', statuses: readonly Status[]): T[] =>
  statuses.length
    ? parse<T>(
        board.db
          .prepare(
            `SELECT json FROM entities WHERE kind='${kind}' AND json_extract(json,'$.status') IN (${placeholders(statuses)}) ORDER BY +rowid`,
          )
          .all(...statuses),
      )
    : [];

/** Runs in any of the given statuses, through the queue status index. */
export const runsWithStatus = (board: Queryable, statuses: readonly Run['status'][]): Run[] =>
  withStatus<Run>(board, 'run', statuses);
/** Crew tasks in any of the given statuses, through the queue status index. */
export const tasksWithStatus = (
  board: Queryable,
  statuses: readonly AgentTask['status'][],
): AgentTask[] => withStatus<AgentTask>(board, 'task', statuses);
/** Every run for one job card, in any status. */
export const runsForCard = (board: Queryable, cardId: string): Run[] =>
  parse<Run>(
    board.db
      .prepare(
        "SELECT json FROM entities WHERE kind='run' AND json_extract(json,'$.cardId')=? ORDER BY rowid",
      )
      .all(cardId),
  );
/** Every run started in one conversation, in any status. */
export const runsForThread = (board: Queryable, threadId: string): Run[] =>
  parse<Run>(
    board.db
      .prepare(
        "SELECT json FROM entities WHERE kind='run' AND json_extract(json,'$.threadId')=? ORDER BY rowid",
      )
      .all(threadId),
  );
/** Every run belonging to one managed deep review, including subagents and seat reservations. */
export const runsForDeepReview = (board: Queryable, reviewId: string): Run[] =>
  parse<Run>(
    board.db
      .prepare(
        "SELECT json FROM entities WHERE kind='run' AND json_extract(json,'$.deepReviewId')=? ORDER BY rowid",
      )
      .all(reviewId),
  );
/** One run by ID, or undefined when it does not exist (unlike `get`, which throws). */
export const findRun = (board: Queryable, id: string): Run | undefined => {
  const row = board.db.prepare("SELECT json FROM entities WHERE kind='run' AND id=?").get(id) as
    | { json: string }
    | undefined;
  return row ? (JSON.parse(row.json) as Run) : undefined;
};
/**
 * Runs by ID without their configuration snapshot and activity, for checks that read only
 * identity, status and chain fields. Missing IDs are absent from the map.
 */
export const runHeaders = (
  board: Queryable,
  ids: Iterable<string>,
): Map<string, Omit<Run, 'configuration' | 'activity'>> => {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = board.db
    .prepare(
      "SELECT json_remove(json,'$.configuration','$.activity') AS json FROM entities WHERE kind='run' AND id IN (SELECT value FROM json_each(?))",
    )
    .all(JSON.stringify(unique));
  return new Map(parse<Run>(rows).map((run) => [run.id, run]));
};
