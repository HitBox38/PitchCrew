import type { BoardEvent } from '@pitchcrew/core';
import Database from 'better-sqlite3';
import { consumeApproval, decideApproval, requestApproval } from './approvals.ts';
import { createCard, hasActiveRun, move, updateCard } from './cards.ts';
import { close, events, get, history, list, rebuild, record } from './events.ts';
import { seedRoles } from './roles.ts';
import type { BoardContext } from './types.ts';

export function createBoardContext(filename: string): BoardContext {
  const context: BoardContext = {
    filename,
    db: new Database(filename),

    close: (...args) => close.call(context, ...args),
    list: <T>(kind: BoardEvent['kind']) => (list<T>).call(context, kind),
    get: <T>(kind: BoardEvent['kind'], id: string) => (get<T>).call(context, kind, id),
    record: (...args) => record.call(context, ...args),
    events: (...args) => events.call(context, ...args),
    history: (...args) => history.call(context, ...args),
    rebuild: (...args) => rebuild.call(context, ...args),
    createCard: (...args) => createCard.call(context, ...args),
    updateCard: (...args) => updateCard.call(context, ...args),
    move: (...args) => move.call(context, ...args),
    requestApproval: (...args) => requestApproval.call(context, ...args),
    decideApproval: (...args) => decideApproval.call(context, ...args),
    consumeApproval: (...args) => consumeApproval.call(context, ...args),
    hasActiveRun: (...args) => hasActiveRun.call(context, ...args),
    seedRoles: (...args) => seedRoles.call(context, ...args),
  };

  context.db.pragma('journal_mode = WAL');
  context.db.pragma('busy_timeout = 5000');
  context.db
    .exec(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Events are append-only'); END;`);
  return context;
}
