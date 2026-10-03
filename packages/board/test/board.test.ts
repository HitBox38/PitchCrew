import { cardInput, decodeEvent, type Card } from '@pitchcrew/core';
import { afterEach, describe, expect, it } from 'vitest';
import { Board, digestPacket } from '../src/index.ts';
import { packet } from './fixtures/packet.ts';

const boards: Board[] = [];
function create() {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
}
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
function reviewed(board: Board) {
  const card = board.createCard(cardInput.parse({ company: 'Example', title: 'Engineer' }));
  board.move(card.id, 'shortlisted', 'user');
  board.move(card.id, 'drafting', 'writer');
  board.updateCard(card.id, { packet }, 'writer', 'Drafted');
  board.move(card.id, 'in_review', 'writer');
  board.move(card.id, 'agreed', 'reviewer');
  return card.id;
}
describe('event-sourced board', () => {
  it('rejects illegal transitions without recording an event', () => {
    const board = create();
    const card = board.createCard(cardInput.parse({ company: 'Example', title: 'Engineer' }));
    expect(() => board.move(card.id, 'submitted', 'user')).toThrow('Cannot move');
    expect(board.events()).toHaveLength(1);
  });
  it('rebuilds projections from retained versioned events', () => {
    const board = create();
    const id = reviewed(board);
    const original = board.get<Card>('card', id);
    // Append a retained v1 event to model a workspace created before chat support.
    const legacy = { ...board.events()[0], version: 1 };
    board.db.prepare('INSERT INTO events(json) VALUES (?)').run(JSON.stringify(legacy));
    board.db
      .prepare('INSERT INTO events(json) VALUES (?)')
      .run(JSON.stringify({ ...legacy, version: 2 }));
    const message = {
      id: 'fixture-message',
      threadId: 'scout' as const,
      from: 'user' as const,
      to: 'scout' as const,
      content: 'Fixture chat',
      cardId: null,
      runId: null,
      createdAt: '',
    };
    board.db
      .prepare('INSERT INTO events(json) VALUES (?)')
      .run(JSON.stringify({ ...legacy, version: 3 }));
    board.db
      .prepare('INSERT INTO events(json) VALUES (?)')
      .run(JSON.stringify({ ...legacy, version: 4 }));
    board.db
      .prepare('INSERT INTO events(json) VALUES (?)')
      .run(JSON.stringify({ ...legacy, version: 5 }));
    board.record('message', message, 'user', 'Fixture chat');
    const events = board.events();
    board.rebuild();
    expect(board.get('card', id)).toEqual(original);
    expect(board.events()).toEqual(events);
    expect(board.get('message', message.id)).toEqual(message);
    expect(events.some((e) => e.version === 1)).toBe(true);
    expect(events.some((e) => e.version === 2)).toBe(true);
    expect(events.some((e) => e.version === 3)).toBe(true);
    expect(events.some((e) => e.version === 4)).toBe(true);
    expect(events.some((e) => e.version === 5)).toBe(true);
    expect(events.some((e) => e.version === 6)).toBe(true);
    expect(() => decodeEvent('{"version":9}')).toThrow('Unsupported');
  });
  it('prevents event deletion and rewriting at the database layer', () => {
    const board = create();
    reviewed(board);
    expect(() => board.db.exec('DELETE FROM events')).toThrow('append-only');
    expect(() => board.db.exec("UPDATE events SET json = '{}' ")).toThrow('append-only');
  });
  it('pages one card history independently of activity on other cards', () => {
    const board = create();
    const id = reviewed(board);
    const other = reviewed(board);
    for (let i = 0; i < 110; i++)
      board.updateCard(other, { fit: i % 100 }, 'scout', 'Other card activity');
    expect(board.events().some((event) => event.entityId === id)).toBe(false);
    const first = board.history(id, undefined, 2);
    const second = board.history(id, first.at(-1)!.id, 2);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(second.every((event) => event.entityId === id && event.id < first.at(-1)!.id)).toBe(
      true,
    );
  });
});
describe('approval tokens', () => {
  it('requires an exact-payload approval and consumes it once', () => {
    const board = create();
    const id = reviewed(board);
    const approval = board.requestApproval(id);
    expect(() => board.consumeApproval(approval.id, id, approval.digest)).toThrow(
      'unused approval',
    );
    board.decideApproval(approval.id, true);
    expect(() => board.consumeApproval(approval.id, id, 'changed-digest')).toThrow();
    expect(board.consumeApproval(approval.id, id, approval.digest)).toEqual(packet);
    expect(() => board.consumeApproval(approval.id, id, approval.digest)).toThrow(
      'unused approval',
    );
  });
  it('rejects a changed packet or a different card', () => {
    const board = create();
    const id = reviewed(board);
    const other = reviewed(board);
    const approval = board.requestApproval(id);
    board.decideApproval(approval.id, true);
    expect(() => board.consumeApproval(approval.id, other, approval.digest)).toThrow();
    const changed = { ...packet, note: 'Changed after approval' };
    board.updateCard(id, { packet: changed }, 'writer', 'Changed');
    expect(digestPacket(id, changed)).not.toBe(approval.digest);
    expect(() => board.consumeApproval(approval.id, id, approval.digest)).toThrow();
  });
  it('returns rejected requests to reviewed and cannot decide twice', () => {
    const board = create();
    const id = reviewed(board);
    const approval = board.requestApproval(id);
    board.decideApproval(approval.id, false);
    expect(board.get<Card>('card', id).state).toBe('agreed');
    expect(() => board.decideApproval(approval.id, true)).toThrow('already been decided');
  });
});
