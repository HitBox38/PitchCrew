import { cardInput, type Card, type TrackingSignal } from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import {
  Board,
  latestTrackingTime,
  trackingConflict,
  registerExistingExternalSubmission,
} from '../src/index.ts';
import { packet } from './fixtures/packet.ts';

const boards: Board[] = [];
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
it('does not let email tracking skip exact-packet approval and successful export prerequisites', () => {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(cardInput.parse({ company: 'Fictional Labs', title: 'Engineer' }));
  for (const state of ['shortlisted', 'drafting', 'in_review', 'agreed'] as const)
    board.move(card.id, state, 'scout');
  board.updateCard(card.id, { packet }, 'writer', 'Drafted fixture');
  const approval = board.requestApproval(card.id);
  const evidence = {
    state: 'submitted',
    effectiveAt: new Date(Date.now() + 10000).toISOString(),
  } as TrackingSignal;
  expect(trackingConflict(board, evidence, board.get<Card>('card', card.id))).toContain(
    'Approve and export',
  );
  board.decideApproval(approval.id, true);
  board.consumeApproval(approval.id, card.id, approval.digest);
  expect(trackingConflict(board, evidence, board.get<Card>('card', card.id))).toContain(
    'Approve and export',
  );
  board.record(
    'approval',
    { ...approval, status: 'consumed', exportDirectory: 'fixture-export' },
    'mcp',
    'Fixture export completed',
  );
  expect(trackingConflict(board, evidence, board.get<Card>('card', card.id))).toBe('');
  board.updateCard(
    card.id,
    { packet: { ...packet, note: 'Changed fixture packet' } },
    'writer',
    'Revised packet',
  );
  expect(trackingConflict(board, evidence, board.get<Card>('card', card.id))).toContain(
    'Approve and export',
  );
});
it('imports a user-confirmed external fact on an existing card while retaining its packet and invalidating unused approvals', () => {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(cardInput.parse({ company: 'Fictional Labs', title: 'Engineer' }));
  const input = {
    submittedAt: '2025-01-01T00:00:00Z',
    note: 'Confirmed separately using the external careers website.',
  };
  board.updateCard(card.id, { owner: 'writer' }, 'writer', 'Active writer fixture');
  expect(() => registerExistingExternalSubmission(board, card.id, input)).toThrow(
    'active workflow',
  );
  board.updateCard(card.id, { owner: null }, 'system', 'Release fixture');
  for (const state of ['shortlisted', 'drafting', 'in_review', 'agreed'] as const)
    board.move(card.id, state, 'scout');
  board.updateCard(card.id, { packet }, 'writer', 'Retained independent draft');
  const approval = board.requestApproval(card.id);
  board.decideApproval(approval.id, true);
  const imported = registerExistingExternalSubmission(board, card.id, input);
  expect(imported).toMatchObject({
    id: card.id,
    state: 'submitted',
    packet,
    statusEffectiveAt: input.submittedAt,
    tracking: { origin: 'external', note: input.note },
  });
  expect(board.get('approval', approval.id)).toMatchObject({ status: 'rejected' });
  expect(board.list('card')).toHaveLength(1);
  expect(() => registerExistingExternalSubmission(board, card.id, input)).toThrow('already');
  board.rebuild();
  expect(board.get('card', card.id)).toEqual(imported);
});
it('retains legacy user status corrections beyond an activity page without treating later packet edits as status times', () => {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(cardInput.parse({ company: 'Fictional Labs', title: 'Engineer' }));
  // A retained pre-tracking user status event has no statusEffectiveAt field.
  board.record('card', { ...card, state: 'submitted' }, 'user', 'Legacy recorded application');
  const boundary = Date.parse(board.events()[0]!.createdAt);
  for (let i = 0; i < 205; i++)
    board.updateCard(card.id, { fit: i % 100 }, 'user', 'Unrelated edits');
  const current = board.get<Card>('card', card.id);
  expect(latestTrackingTime(board, current)).toBe(boundary);
  board.rebuild();
  expect(latestTrackingTime(board, board.get<Card>('card', card.id))).toBe(boundary);
});
