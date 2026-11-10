import { decodeEvent, type BoardEvent, type Card, type Run } from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';

/** Large source documents and saved turn bodies are fetched only by their open views. */
export const workspaceCards = (board: Board): Card[] => {
  return (
    board.db
      .prepare(`SELECT json_set(json_remove(json,'$.sourceHtml'),'$.description','') AS json
    FROM entities WHERE kind='card' ORDER BY rowid`)
      .all() as { json: string }[]
  ).map((row) => JSON.parse(row.json) as Card);
};
/** Runs keep only the effective model/reasoning from their configuration snapshot. */
export const compactRunColumns = `json_extract(json,'$.configuration.role.model') AS model,
    json_extract(json,'$.configuration.role.reasoning') AS reasoning`;
export interface CompactRunRow {
  json: string;
  model: string | null;
  reasoning: Run['reasoning'] | null;
}
export const compactRunRow = ({ json, model, reasoning }: CompactRunRow): Run => ({
  ...(JSON.parse(json) as Run),
  ...(model ? { model } : {}),
  ...(reasoning ? { reasoning } : {}),
});
const compactRunSql = `SELECT id, json_remove(json,'$.configuration','$.activity') AS json,
    ${compactRunColumns} FROM entities WHERE kind='run'`;
type CompactRunCache = { cursor: number; runs: Map<string, Run> };
const compactRunCaches = new WeakMap<Board, CompactRunCache>();
/**
 * Every run row carries its frozen role/skill configuration, so one scan reads all of it. Scan
 * once per board, then refetch only runs named by newer append-only events. Events commit in the
 * same transaction as their projection (other connections append them too), so rolled-back or
 * external writes never leave a stale entry. Map order is first-event order, which is the
 * projection's insertion (rowid) order.
 */
export const workspaceRuns = (board: Board): Run[] => {
  // An enclosing transaction may still roll back; never cache its uncommitted projection.
  const cacheable = !board.db.inTransaction;
  const runs = board.db.transaction(() => {
    const cursor =
      (board.db.prepare('SELECT max(id) AS id FROM events').get() as { id: number | null }).id ?? 0;
    const cache = cacheable ? compactRunCaches.get(board) : undefined;
    if (cache?.cursor === cursor) return cache.runs;
    const rows = (sql: string, ...args: unknown[]) =>
      board.db.prepare(sql).all(...args) as (CompactRunRow & { id: string })[];
    const runs = cache?.runs ?? new Map<string, Run>();
    if (!cache)
      for (const row of rows(`${compactRunSql} ORDER BY rowid`))
        runs.set(row.id, compactRunRow(row));
    else
      for (const { id } of board.db
        .prepare(
          `SELECT json_extract(json,'$.entityId') AS id FROM events
            WHERE id > ? AND json_extract(json,'$.kind')='run' GROUP BY 1 ORDER BY min(id)`,
        )
        .all(cache.cursor) as { id: string }[]) {
        const [row] = rows(`${compactRunSql} AND id=?`, id);
        if (row) runs.set(id, compactRunRow(row));
        else runs.delete(id);
      }
    if (cacheable) compactRunCaches.set(board, { cursor, runs });
    return runs;
  })();
  // Callers own the returned runs; the cache keeps its own copies.
  return structuredClone([...runs.values()].reverse());
};

/** Full deep-review prose is fetched only when opening a report. */
export const workspaceEvents = (board: Board): BoardEvent[] => {
  const rows = board.db
    .prepare(
      `SELECT id, CASE WHEN json_extract(json,'$.kind') IN ('deep_review','review_subagent') THEN json_remove(json,'$.data.originalResume','$.data.finalResume','$.data.before','$.data.after','$.data.assessment') ELSE json END AS json FROM events ORDER BY id DESC LIMIT 100`,
    )
    .all() as { id: number; json: string }[];
  return rows.map((row) => ({ ...decodeEvent(row.json), id: row.id }));
};
