import { cardInput, states, type Approval, type Card, type Run } from '@pitchcrew/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board, setCardStatus } from '../src/index.ts';
import { packet } from './fixtures/packet.ts';
import { reviewFixturePacket } from './fixtures/application-context.ts';

const boards: Board[] = [];
function fixture() {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(
    cardInput.parse({ company: 'Fictional Studio', title: 'Engineer' }),
  );
  return { board, card };
}
afterEach(() => {
  vi.restoreAllMocks();
  for (const board of boards.splice(0)) board.close();
});

describe('user status changes', () => {
  it('supports every status pair, preserves application data and replays manual history', () => {
    const { board, card } = fixture();
    for (const from of states)
      for (const to of states) {
        const source = { ...card, state: from, packet, fit: 85, feedback: ['Saved feedback'] };
        board.record('card', source, 'system', 'Fictional source status');
        const before = board.events(1000).length;
        const next = setCardStatus(board, card.id, to);
        expect(next).toMatchObject({ ...source, state: to, updatedAt: expect.any(String) });
        expect(board.events(1000)).toHaveLength(before + (from === to ? 0 : 1));
        if (from !== to) {
          expect(next.statusEffectiveAt).toBe(next.updatedAt);
          expect(board.events()[0]).toMatchObject({ actor: 'user', kind: 'card' });
        }
      }
    const final = board.get<Card>('card', card.id);
    board.rebuild();
    expect(board.get<Card>('card', card.id)).toEqual(final);
    expect(board.list('run')).toEqual([]);
    expect(board.list('approval')).toEqual([]);
    expect(() => board.move(card.id, 'lead', 'writer')).toThrow('Cannot move');
  });

  it('invalidates pending and approved exports even when the card later returns to approval', () => {
    const { board, card } = fixture();
    board.updateCard(card.id, { packet }, 'writer', 'Fictional packet');
    setCardStatus(board, card.id, 'agreed');
    expect(() => board.requestApproval(card.id)).toThrow('brief first');
    reviewFixturePacket(board, card.id);
    const pending = board.requestApproval(card.id);
    const approved = { ...pending, id: 'approved', status: 'approved' } as Approval;
    const consumed = { ...pending, id: 'consumed', status: 'consumed' } as Approval;
    board.record('approval', approved, 'user', 'Fictional approved export');
    board.record('approval', consumed, 'user', 'Fictional consumed export');
    setCardStatus(board, card.id, 'lead');
    expect(board.get<Approval>('approval', pending.id).status).toBe('rejected');
    expect(board.get<Approval>('approval', approved.id).status).toBe('rejected');
    expect(board.get<Approval>('approval', consumed.id)).toEqual(consumed);
    setCardStatus(board, card.id, 'awaiting_approval');
    expect(() => board.consumeApproval(approved.id, card.id, approved.digest)).toThrow(
      'unused approval',
    );
    expect(() => board.decideApproval(pending.id, true)).toThrow('already been decided');
    board.rebuild();
    expect(board.get<Approval>('approval', approved.id).status).toBe('rejected');
  });

  it('rolls back the status and its event if approval invalidation fails', () => {
    const { board, card } = fixture();
    board.updateCard(card.id, { packet }, 'writer', 'Fictional packet');
    setCardStatus(board, card.id, 'agreed');
    reviewFixturePacket(board, card.id);
    const approval = board.requestApproval(card.id);
    const source = board.get<Card>('card', card.id);
    const events = board.events();
    const record = board.record.bind(board);
    vi.spyOn(board, 'record').mockImplementation((...args) => {
      if (args[0] === 'approval') throw new Error('Fictional write failure');
      return record(...args);
    });
    expect(() => setCardStatus(board, card.id, 'withdrawn')).toThrow('Fictional write failure');
    expect(board.get<Card>('card', card.id)).toEqual(source);
    expect(board.get<Approval>('approval', approval.id).status).toBe('pending');
    expect(board.events()).toEqual(events);
  });

  it('rejects owned cards, attached chat runs and invalid states without recording changes', () => {
    const { board, card } = fixture();
    board.updateCard(card.id, { owner: 'scout' }, 'scout', 'Claimed');
    expect(() => setCardStatus(board, card.id, 'submitted')).toThrow('active run');
    board.updateCard(card.id, { owner: null }, 'scout', 'Released');
    board.record(
      'run',
      {
        id: 'chat',
        cardId: card.id,
        roleId: 'scout',
        runtime: 'demo',
        mode: 'chat',
        status: 'running',
        message: '',
        startedAt: '',
        finishedAt: null,
      } as Run,
      'scout',
      'Fictional attached chat',
    );
    const events = board.events();
    expect(() => setCardStatus(board, card.id, 'offer')).toThrow('active run');
    expect(() => setCardStatus(board, card.id, 'unknown' as Card['state'])).toThrow(
      'Unknown job status',
    );
    expect(board.events()).toEqual(events);
  });
});
