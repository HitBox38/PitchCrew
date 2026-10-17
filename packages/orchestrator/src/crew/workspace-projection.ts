import { decodeEvent, type BoardEvent, type Card, type Run } from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';

/** Large source documents and saved turn bodies are fetched only by their open views. */
export function workspaceCards(board: Board): Card[] {
  return (
    board.db
      .prepare(`SELECT json_set(json_remove(json,'$.sourceHtml'),'$.description','') AS json
    FROM entities WHERE kind='card' ORDER BY rowid`)
      .all() as { json: string }[]
  ).map((row) => JSON.parse(row.json) as Card);
}
export function workspaceRuns(board: Board): Run[] {
  return (
    board.db
      .prepare(`SELECT json_remove(json,'$.configuration','$.activity') AS json
    FROM entities WHERE kind='run' ORDER BY rowid DESC`)
      .all() as { json: string }[]
  ).map((row) => JSON.parse(row.json) as Run);
}

/** Full deep-review prose is fetched only when opening a report. */
export function workspaceEvents(board: Board): BoardEvent[] {
  const rows = board.db
    .prepare(
      `SELECT id, CASE WHEN json_extract(json,'$.kind') IN ('deep_review','review_subagent') THEN json_remove(json,'$.data.originalResume','$.data.finalResume','$.data.before','$.data.after','$.data.assessment') ELSE json END AS json FROM events ORDER BY id DESC LIMIT 100`,
    )
    .all() as { id: number; json: string }[];
  return rows.map((row) => ({ ...decodeEvent(row.json), id: row.id }));
}
