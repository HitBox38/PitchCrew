import type { Card, Run } from '@pitchcrew/core';
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
