import { currentEventVersion, decodeEvent, type BoardEvent, type Card } from '@pitchcrew/core';
import type { BoardContext } from './types.ts';

export const close = (context: BoardContext): void => {
  context.db.close();
};
export const list = <T>(context: BoardContext, kind: BoardEvent['kind']): T[] => {
  const query =
    kind === 'conversation'
      ? "SELECT json FROM entities WHERE kind = ? AND json_extract(json,'$.deletedAt') IS NULL ORDER BY rowid"
      : 'SELECT json FROM entities WHERE kind = ? ORDER BY rowid';
  return (
    context.db.prepare(query).all(kind) as {
      json: string;
    }[]
  ).map((x) => JSON.parse(x.json) as T);
};
export const get = <T>(context: BoardContext, kind: BoardEvent['kind'], id: string): T => {
  const row = context.db
    .prepare('SELECT json FROM entities WHERE kind = ? AND id = ?')
    .get(kind, id) as { json: string } | undefined;
  if (!row || (kind === 'conversation' && JSON.parse(row.json).deletedAt))
    throw new Error(`${kind} not found.`);
  return JSON.parse(row.json) as T;
};
export const record = (
  context: BoardContext,
  kind: BoardEvent['kind'],
  data: BoardEvent['data'],
  actor: string,
  message: string,
): BoardEvent => {
  return context.db.transaction(() => {
    const event: BoardEvent = {
      id: 0,
      version: currentEventVersion,
      kind,
      entityId: data.id,
      data,
      actor,
      message,
      createdAt: new Date().toISOString(),
    };
    const row = context.db
      .prepare('INSERT INTO events(json) VALUES (?)')
      .run(JSON.stringify(event));
    project(context, event);
    return { ...event, id: Number(row.lastInsertRowid) };
  })();
};
export const events = (context: BoardContext, limit: number = 100): BoardEvent[] => {
  return (
    context.db.prepare('SELECT id,json FROM events ORDER BY id DESC LIMIT ?').all(limit) as {
      id: number;
      json: string;
    }[]
  ).map((row) => ({ ...decodeEvent(row.json), id: row.id }));
};
export const history = (
  context: BoardContext,
  entityId: string,
  before: number = Number.MAX_SAFE_INTEGER,
  limit: number = 100,
): BoardEvent[] => {
  return (
    context.db
      .prepare(
        "SELECT id,json FROM events WHERE json_extract(json,'$.entityId') = ? AND id < ? ORDER BY id DESC LIMIT ?",
      )
      .all(entityId, before, limit) as { id: number; json: string }[]
  ).map((row) => ({ ...decodeEvent(row.json), id: row.id }));
};
export const rebuild = (context: BoardContext): void => {
  context.db.transaction(() => {
    context.db.exec('DELETE FROM entities');
    const rows = context.db.prepare('SELECT json FROM events ORDER BY id').all() as {
      json: string;
    }[];
    for (const row of rows) {
      const e = decodeEvent(row.json);
      project(context, e);
    }
  })();
};

const project = (context: BoardContext, event: BoardEvent): void => {
  // Keep conversation tombstones so startup migration cannot recreate deleted default chats.
  const data = event.data as { deletedAt?: string; threadId?: string };
  if (event.kind === 'conversation' && data.deletedAt)
    context.db
      .prepare(
        "DELETE FROM entities WHERE kind IN ('message','chat_request','conversation_session') AND json_extract(json,'$.threadId') = ?",
      )
      .run(event.entityId);
  if (
    event.kind === 'conversation' ||
    ['message', 'chat_request', 'conversation_session'].includes(event.kind)
  ) {
    const thread = event.kind === 'conversation' ? event.entityId : data.threadId;
    if (
      context.db
        .prepare(
          "SELECT 1 FROM entities WHERE kind='conversation' AND id=? AND json_extract(json,'$.deletedAt') IS NOT NULL",
        )
        .get(thread)
    )
      return;
  }
  if (event.kind === 'card' && (event.data as Card).deletedAt) {
    context.db
      .prepare('DELETE FROM entities WHERE kind = ? AND id = ?')
      .run('card', event.entityId);
    return;
  }
  context.db
    .prepare(
      'INSERT INTO entities(kind,id,json) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json',
    )
    .run(event.kind, event.entityId, JSON.stringify(event.data));
};
