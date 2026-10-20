import type { BoardEvent } from '@pitchcrew/core';
import Database from 'better-sqlite3';
import { consumeApproval, decideApproval, requestApproval } from './approvals.ts';
import { createCard, hasActiveRun, move, updateCard } from './cards.ts';
import { close, events, get, history, list, rebuild, record } from './events.ts';
import { seedRoles } from './roles.ts';
import { defaultInstructionStatuses } from './default-instructions.ts';
import type { BoardContext } from './types.ts';

export const createBoardContext = (filename: string): BoardContext => {
  const context: BoardContext = {
    filename,
    db: new Database(filename),

    close: (...args) => close(context, ...args),
    list: <T>(kind: BoardEvent['kind']) => list<T>(context, kind),
    get: <T>(kind: BoardEvent['kind'], id: string) => get<T>(context, kind, id),
    record: (...args) => record(context, ...args),
    events: (...args) => events(context, ...args),
    history: (...args) => history(context, ...args),
    rebuild: (...args) => rebuild(context, ...args),
    createCard: (...args) => createCard(context, ...args),
    updateCard: (...args) => updateCard(context, ...args),
    move: (...args) => move(context, ...args),
    requestApproval: (...args) => requestApproval(context, ...args),
    decideApproval: (...args) => decideApproval(context, ...args),
    consumeApproval: (...args) => consumeApproval(context, ...args),
    hasActiveRun: (...args) => hasActiveRun(context, ...args),
    seedRoles: (...args) => seedRoles(context, ...args),
    defaultInstructionStatuses: () => defaultInstructionStatuses(context),
  };

  context.db.pragma('journal_mode = WAL');
  context.db.pragma('busy_timeout = 5000');
  context.db
    .exec(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(kind,id));
      -- A single-column kind index is ordered by implicit rowid within each kind. The
      -- (kind,id) primary key instead requires sorting every matching JSON document.
      CREATE INDEX IF NOT EXISTS entities_kind ON entities(kind);
      CREATE INDEX IF NOT EXISTS entities_thread ON entities(kind,json_extract(json,'$.threadId')) WHERE kind='message' OR kind='run';
      CREATE INDEX IF NOT EXISTS entities_deep_review_card ON entities(kind,json_extract(json,'$.cardId')) WHERE kind='deep_review';
      CREATE INDEX IF NOT EXISTS entities_review_parent ON entities(kind,json_extract(json,'$.reviewId')) WHERE kind='review_subagent';
      CREATE INDEX IF NOT EXISTS events_entity_id ON events(json_extract(json,'$.entityId'));
      CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Events are append-only'); END;`);
  return context;
};
