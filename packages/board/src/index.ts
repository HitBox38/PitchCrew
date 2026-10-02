import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import {
  assertTransition,
  decodeEvent,
  type Card,
  type CardInput,
  type CardState,
  type Role,
  type Run,
  type Approval,
  type BoardEvent,
  type Packet,
} from '@pitchcrew/core';

export function digestPacket(cardId: string, packet: Packet) {
  return createHash('sha256')
    .update(JSON.stringify({ cardId, action: 'export_packet', packet }))
    .digest('hex');
}
export class Board {
  readonly db: Database.Database;
  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entities (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(kind,id));
      CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'Events are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'Events are append-only'); END;`);
  }
  close() {
    this.db.close();
  }
  list<T>(kind: BoardEvent['kind']): T[] {
    return (
      this.db.prepare('SELECT json FROM entities WHERE kind = ? ORDER BY rowid').all(kind) as {
        json: string;
      }[]
    ).map((x) => JSON.parse(x.json) as T);
  }
  get<T>(kind: BoardEvent['kind'], id: string): T {
    const row = this.db
      .prepare('SELECT json FROM entities WHERE kind = ? AND id = ?')
      .get(kind, id) as { json: string } | undefined;
    if (!row) throw new Error(`${kind} not found.`);
    return JSON.parse(row.json) as T;
  }
  record(kind: BoardEvent['kind'], data: BoardEvent['data'], actor: string, message: string) {
    return this.db.transaction(() => {
      const event: BoardEvent = {
        id: 0,
        version: 5,
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
  events(limit = 100): BoardEvent[] {
    return (
      this.db.prepare('SELECT id,json FROM events ORDER BY id DESC LIMIT ?').all(limit) as {
        id: number;
        json: string;
      }[]
    ).map((row) => ({ ...decodeEvent(row.json), id: row.id }));
  }
  history(entityId: string, before = Number.MAX_SAFE_INTEGER, limit = 100): BoardEvent[] {
    return (
      this.db
        .prepare(
          "SELECT id,json FROM events WHERE json_extract(json,'$.entityId') = ? AND id < ? ORDER BY id DESC LIMIT ?",
        )
        .all(entityId, before, limit) as { id: number; json: string }[]
    ).map((row) => ({ ...decodeEvent(row.json), id: row.id }));
  }
  rebuild() {
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
  createCard(input: CardInput, sample = false) {
    const now = new Date().toISOString();
    const card: Card = {
      ...input,
      id: randomUUID(),
      state: 'lead',
      fit: null,
      owner: null,
      packet: null,
      feedback: [],
      createdAt: now,
      updatedAt: now,
      sample,
    };
    this.record('card', card, 'user', `Added ${card.company} to the board`);
    return card;
  }
  updateCard(
    id: string,
    patch: Partial<Pick<Card, 'packet' | 'feedback' | 'fit' | 'owner'>>,
    actor: string,
    message: string,
  ) {
    const card = { ...this.get<Card>('card', id), ...patch, updatedAt: new Date().toISOString() };
    this.record('card', card, actor, message);
    return card;
  }
  move(id: string, state: CardState, actor: string, message?: string) {
    const card = this.get<Card>('card', id);
    assertTransition(card.state, state);
    const next = { ...card, state, updatedAt: new Date().toISOString() };
    this.record('card', next, actor, message ?? `Moved to ${state.replaceAll('_', ' ')}`);
    return next;
  }
  requestApproval(cardId: string) {
    return this.db.transaction(() => {
      const card = this.get<Card>('card', cardId);
      if (card.state !== 'agreed' || !card.packet)
        throw new Error('A reviewed packet is required before requesting approval.');
      const approval: Approval = {
        id: randomUUID(),
        cardId,
        action: 'export_packet',
        packet: card.packet,
        digest: digestPacket(cardId, card.packet),
        status: 'pending',
        createdAt: new Date().toISOString(),
        decidedAt: null,
      };
      this.record('approval', approval, 'user', 'Requested approval to export packet');
      this.move(cardId, 'awaiting_approval', 'user');
      return approval;
    })();
  }
  decideApproval(id: string, approved: boolean) {
    return this.db.transaction(() => {
      const approval = this.get<Approval>('approval', id);
      if (approval.status !== 'pending') throw new Error('This approval has already been decided.');
      const card = this.get<Card>('card', approval.cardId);
      if (
        !card.packet ||
        card.state !== 'awaiting_approval' ||
        digestPacket(card.id, card.packet) !== approval.digest
      )
        throw new Error('The packet changed. Request a new approval.');
      const next: Approval = {
        ...approval,
        status: approved ? 'approved' : 'rejected',
        decidedAt: new Date().toISOString(),
      };
      this.record(
        'approval',
        next,
        'user',
        approved ? 'Approved local packet export' : 'Rejected packet export',
      );
      if (!approved) this.move(approval.cardId, 'agreed', 'user');
      return next;
    })();
  }
  consumeApproval(id: string, cardId: string, digest: string) {
    return this.db.transaction(() => {
      const approval = this.get<Approval>('approval', id);
      const card = this.get<Card>('card', cardId);
      if (
        approval.status !== 'approved' ||
        approval.cardId !== cardId ||
        approval.digest !== digest ||
        card.state !== 'awaiting_approval' ||
        !card.packet ||
        digestPacket(cardId, card.packet) !== digest
      )
        throw new Error('An unused approval for this exact packet is required.');
      this.record(
        'approval',
        { ...approval, status: 'consumed' },
        'mcp',
        'Consumed approval for local export',
      );
      return approval.packet;
    })();
  }
  hasActiveRun(cardId: string) {
    return this.list<Run>('run').some(
      (run) => run.cardId === cardId && run.status === 'running' && run.mode !== 'chat',
    );
  }
  seedRoles() {
    const definitions: Role[] = [
      {
        id: 'scout',
        name: 'Scout',
        description: 'Find the fit before you invest the time.',
        runtime: 'demo',
        model: '',
        enabled: true,
        instructions:
          'Evaluate the provided job against the profile. Explain the fit. Never invent jobs or qualifications.',
      },
      {
        id: 'writer',
        name: 'Writer',
        description: 'Turn your experience into a clear application.',
        runtime: 'demo',
        model: '',
        enabled: true,
        instructions:
          'Write a tailored application packet. Every factual claim must appear verbatim in a profile source and include a source and quote. Never invent achievements.',
      },
      {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Keep every claim grounded in your profile.',
        runtime: 'demo',
        model: '',
        enabled: true,
        instructions:
          'Check every statement in the packet against the profile. Reject unverifiable claims and explain required changes. Review independently.',
      },
    ];
    if (!this.list<Role>('role').length)
      for (const role of definitions)
        this.record('role', role, 'system', `Initialized ${role.name}`);
  }
}
