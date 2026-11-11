import { deliveryLifecycle, type AgentTask, type ChatRequest, type Run } from '@pitchcrew/core';
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

/** One stored entity by primary key, or undefined; never deserializes the rest of its kind. */
export const findEntity = <T>(
  context: CrewContext,
  kind: string,
  id: string | undefined,
): T | undefined => {
  if (!id) return undefined;
  const row = context.board.db
    .prepare('SELECT json FROM entities WHERE kind=? AND id=?')
    .get(kind, id) as { json: string } | undefined;
  return row ? (JSON.parse(row.json) as T) : undefined;
};

const requestsWithDelivery = (
  context: CrewContext,
  condition: string,
  value: string,
): ChatRequest[] => {
  const rows = context.board.db
    .prepare(
      `SELECT e.json FROM entities e WHERE e.kind='chat_request' AND EXISTS (SELECT 1 FROM json_each(e.json,'$.deliveries') d WHERE ${condition}) ORDER BY e.rowid`,
    )
    .all(value) as { json: string }[];
  return rows.map((row) => JSON.parse(row.json) as ChatRequest);
};

/** Chat requests with a delivery that is not done, in insertion order. */
export const unsettledChatRequests = (context: CrewContext): ChatRequest[] =>
  requestsWithDelivery(
    context,
    "json_extract(d.value,'$.status') NOT IN (SELECT value FROM json_each(?))",
    JSON.stringify(deliveryLifecycle.groups.done),
  );

/** Chat requests with at least one queued delivery, in insertion order. */
export const queuedChatRequests = (context: CrewContext): ChatRequest[] =>
  requestsWithDelivery(context, "json_extract(d.value,'$.status')=?", 'queued');
