import {
  Board,
  assertReviewedContext,
  jobSourceRevision,
  saveApplicationContext,
} from '../src/index.ts';
import {
  cardInput,
  currentEventVersion,
  type Card,
  type ComputerApproval,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { packet } from './fixtures/packet.ts';
import { reviewFixturePacket } from './fixtures/application-context.ts';

const boards: Board[] = [];
afterEach(() => {
  for (const board of boards.splice(0)) board.close();
});
it('binds confirmation/review to exact content, expires approvals on adoption, and replays version 19', () => {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
  board.record('card', { ...card, state: 'agreed', packet }, 'user', 'Legacy packet');
  expect(() => board.requestApproval(card.id)).toThrow('brief first');
  const ready = reviewFixturePacket(board, card.id);
  const context = ready.applicationContext!;
  const approval = board.requestApproval(card.id);
  board.decideApproval(approval.id, true);
  board.record(
    'computer_approval',
    {
      id: 'browser-fixture',
      cardId: card.id,
      status: 'approved',
      decidedAt: null,
    } as ComputerApproval,
    'user',
    'Fixture browser approval',
  );
  const changed = {
    brief: { ...context.brief, responsibilities: ['A changed responsibility.'] },
    requirements: context.requirements,
    flagged: context.flagged,
  };
  const active: Run = {
    id: 'source-chat-fixture',
    roleId: 'writer',
    cardId: card.id,
    mode: 'chat',
    runtime: 'demo',
    status: 'running',
    message: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  board.record('run', active, 'user', 'Active attached source chat');
  expect(() =>
    saveApplicationContext(
      board,
      card.id,
      jobSourceRevision(ready),
      context.revision,
      changed,
      true,
    ),
  ).toThrow('active job work');
  board.record('run', { ...active, status: 'cancelled' }, 'user', 'Stopped fixture chat');
  const next = saveApplicationContext(
    board,
    card.id,
    jobSourceRevision(ready),
    context.revision,
    changed,
    true,
  );
  expect(next.packet).toEqual(packet);
  expect(next.applicationContext!.revision).not.toBe(context.revision);
  expect(next.packetReview).toBeUndefined();
  expect(board.get<{ status: string }>('approval', approval.id).status).toBe('rejected');
  expect(board.get<{ status: string }>('computer_approval', 'browser-fixture').status).toBe(
    'rejected',
  );
  expect(() => board.consumeApproval(approval.id, card.id, approval.digest)).toThrow(
    'fresh review',
  );
  expect(() =>
    saveApplicationContext(
      board,
      card.id,
      jobSourceRevision(ready),
      context.revision,
      changed,
      true,
    ),
  ).toThrow('changed');
  board.rebuild();
  expect(board.get<Card>('card', card.id)).toMatchObject({
    applicationContext: { revision: next.applicationContext!.revision },
  });
  expect(board.events().every((event) => event.version === currentEventVersion)).toBe(true);
});

it('retains exact confirmation and review for an unchanged extraction, but rejects raw-source changes', () => {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
  board.updateCard(card.id, { packet }, 'user', 'Fixture packet');
  const ready = reviewFixturePacket(board, card.id);
  const context = ready.applicationContext!;
  const unchanged = saveApplicationContext(
    board,
    card.id,
    context.sourceRevision,
    context.revision,
    { brief: context.brief, requirements: context.requirements, flagged: context.flagged },
    false,
  );
  expect(assertReviewedContext(unchanged).revision).toBe(context.revision);
  board.record(
    'card',
    { ...unchanged, description: 'Changed source' },
    'user',
    'Fixture source edit',
  );
  expect(() => assertReviewedContext(board.get<Card>('card', card.id))).toThrow('brief first');
});
