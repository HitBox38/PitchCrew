import { decodeEvent, type BoardEvent } from '@pitchcrew/core';
import type { BoardContext } from './types.ts';

export function close(this: BoardContext): void {
  this.db.close();
}
export function list<T>(this: BoardContext, kind: BoardEvent['kind']): T[] {
  return (
    this.db.prepare('SELECT json FROM entities WHERE kind = ? ORDER BY rowid').all(kind) as {
      json: string;
    }[]
  ).map((x) => JSON.parse(x.json) as T);
}
export function get<T>(this: BoardContext, kind: BoardEvent['kind'], id: string): T {
  const row = this.db
    .prepare('SELECT json FROM entities WHERE kind = ? AND id = ?')
    .get(kind, id) as { json: string } | undefined;
  if (!row) throw new Error(`${kind} not found.`);
  return JSON.parse(row.json) as T;
}
export function record(
  this: BoardContext,
  kind: BoardEvent['kind'],
  data: BoardEvent['data'],
  actor: string,
  message: string,
): BoardEvent {
  return this.db.transaction(() => {
    const event: BoardEvent = {
      id: 0,
      version:
        kind === 'profile_proposal' ||
        (kind === 'role' &&
          'capabilities' in data &&
          data.capabilities?.maintainProfile !== undefined) ||
        (kind === 'proposal' &&
          'changes' in data &&
          data.changes.capabilities?.maintainProfile !== undefined)
          ? 9
          : kind === 'routine' ||
              (kind === 'run' && 'routineId' in data) ||
              (kind === 'role' &&
                'capabilities' in data &&
                data.capabilities?.manageRoutines !== undefined) ||
              (kind === 'proposal' &&
                'changes' in data &&
                data.changes.capabilities?.manageRoutines !== undefined)
            ? 8
            : kind === 'message' && 'notification' in data
              ? 7
              : 6,
      kind,
      entityId: data.id,
      data,
      actor,
      message,
      createdAt: new Date().toISOString(),
    };
    const row = this.db.prepare('INSERT INTO events(json) VALUES (?)').run(JSON.stringify(event));
    this.db
      .prepare(
        'INSERT INTO entities(kind,id,json) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json',
      )
      .run(kind, data.id, JSON.stringify(data));
    return { ...event, id: Number(row.lastInsertRowid) };
  })();
}
export function events(this: BoardContext, limit: number = 100): BoardEvent[] {
  return (
    this.db.prepare('SELECT id,json FROM events ORDER BY id DESC LIMIT ?').all(limit) as {
      id: number;
      json: string;
    }[]
  ).map((row) => ({ ...decodeEvent(row.json), id: row.id }));
}
export function history(
  this: BoardContext,
  entityId: string,
  before: number = Number.MAX_SAFE_INTEGER,
  limit: number = 100,
): BoardEvent[] {
  return (
    this.db
      .prepare(
        "SELECT id,json FROM events WHERE json_extract(json,'$.entityId') = ? AND id < ? ORDER BY id DESC LIMIT ?",
      )
      .all(entityId, before, limit) as { id: number; json: string }[]
  ).map((row) => ({ ...decodeEvent(row.json), id: row.id }));
}
export function rebuild(this: BoardContext): void {
  this.db.transaction(() => {
    this.db.exec('DELETE FROM entities');
    const rows = this.db.prepare('SELECT json FROM events ORDER BY id').all() as {
      json: string;
    }[];
    for (const row of rows) {
      const e = decodeEvent(row.json);
      this.db
        .prepare(
          'INSERT INTO entities(kind,id,json) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET json=excluded.json',
        )
        .run(e.kind, e.entityId, JSON.stringify(e.data));
    }
  })();
}
