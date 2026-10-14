import { reviewFixturePacket } from './fixtures/application-context.ts';
import {
  cardInput,
  currentEventVersion,
  states,
  type AgentTask,
  type Approval,
  type Card,
  type ComputerApproval,
  type Routine,
  type Run,
} from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { Board, changeJobState, deleteJob } from '../src/index.ts';
import { packet } from './fixtures/packet.ts';

const boards: Board[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const board of boards.splice(0)) board.close();
});
function setup() {
  const board = new Board(':memory:');
  boards.push(board);
  const card = board.createCard(cardInput.parse({ company: 'Fixture', title: 'Engineer' }));
  return { board, card };
}

it('allows every pair of statuses, including terminal states and same-state requests', () => {
  const { board, card } = setup();
  for (const from of states)
    for (const to of states) {
      changeJobState(board, card.id, from, 'scout', 'Set starting state');
      expect(changeJobState(board, card.id, to, 'scout', 'Correct board status').state).toBe(to);
      expect(board.get<Card>('card', card.id)).toMatchObject({ state: to, owner: null });
    }
  board.rebuild();
  expect(board.get<Card>('card', card.id).state).toBe(states.at(-1));
  changeJobState(board, card.id, 'lead', 'scout', 'Reopen');
  expect(() => board.move(card.id, 'offer', 'scout')).toThrow('Cannot move');
});

it.each(states)('deletes a %s job durably without removing its history', (state) => {
  const { board, card } = setup();
  changeJobState(board, card.id, state, 'scout', 'Set starting state');
  const before = board.history(card.id).length;
  deleteJob(board, card.id, 'scout', 'Remove this job');
  expect(board.list('card')).toEqual([]);
  expect(() => board.get('card', card.id)).toThrow('not found');
  expect(board.history(card.id)).toHaveLength(before + 1);
  expect(board.history(card.id)[0]).toMatchObject({
    version: currentEventVersion,
    actor: 'scout',
    message: 'Remove this job',
    data: { deletedAt: expect.any(String), state },
  });
  board.rebuild();
  expect(board.list('card')).toEqual([]);
  expect(() => changeJobState(board, card.id, 'lead', 'scout', 'Restore')).toThrow('not found');
});

function approvals(board: Board, cardId: string) {
  board.updateCard(cardId, { packet }, 'writer', 'Fixture packet');
  changeJobState(board, cardId, 'agreed', 'reviewer', 'Fixture reviewed packet');
  reviewFixturePacket(board, cardId);
  const approval = board.requestApproval(cardId);
  board.decideApproval(approval.id, true);
  const browser = {
    id: 'fixture-browser',
    cardId,
    status: 'approved',
    decidedAt: null,
  } as ComputerApproval;
  board.record('computer_approval', browser, 'user', 'Fixture browser approval');
  return approval;
}

it('invalidates unused approvals and prevents reuse after moving back to approval status', () => {
  const { board, card } = setup();
  const approval = approvals(board, card.id);
  changeJobState(board, card.id, 'rejected', 'scout', 'Correct outcome');
  expect(board.get<Approval>('approval', approval.id).status).toBe('rejected');
  expect(board.get<ComputerApproval>('computer_approval', 'fixture-browser').status).toBe(
    'rejected',
  );
  expect(board.get<Card>('card', card.id).statusEffectiveAt).toEqual(expect.any(String));
  changeJobState(board, card.id, 'awaiting_approval', 'scout', 'Correct again');
  expect(() => board.consumeApproval(approval.id, card.id, approval.digest)).toThrow(
    'unused approval',
  );
});

it('deletion invalidates approvals, cancels queued work and pauses attached routines', () => {
  const { board, card } = setup();
  const other = board.createCard(cardInput.parse({ company: 'Other', title: 'Engineer' }));
  const approval = approvals(board, card.id);
  for (const id of [card.id, other.id]) {
    board.record(
      'task',
      { id: `task-${id}`, cardId: id, status: 'queued' } as AgentTask,
      'scout',
      'Fixture',
    );
    board.record(
      'routine',
      { id: `routine-${id}`, cardId: id, enabled: true, deletedAt: null } as Routine,
      'user',
      'Fixture',
    );
  }
  deleteJob(board, card.id, 'scout', 'Remove duplicate');
  expect(board.get<Approval>('approval', approval.id).status).toBe('rejected');
  expect(board.get<ComputerApproval>('computer_approval', 'fixture-browser').status).toBe(
    'rejected',
  );
  expect(board.get<AgentTask>('task', `task-${card.id}`).status).toBe('cancelled');
  expect(board.get<Routine>('routine', `routine-${card.id}`)).toMatchObject({
    enabled: false,
    nextRunAt: null,
  });
  expect(board.get<AgentTask>('task', `task-${other.id}`).status).toBe('queued');
  expect(board.get<Routine>('routine', `routine-${other.id}`).enabled).toBe(true);
});

it('blocks active workflow work and rolls back the whole deletion if dependent cleanup fails', () => {
  const { board, card } = setup();
  board.record(
    'run',
    { id: 'busy', cardId: card.id, status: 'running', mode: 'workflow' } as Run,
    'writer',
    'Fixture',
  );
  const before = board.events();
  expect(() => changeJobState(board, card.id, 'offer', 'scout', 'Correct')).toThrow('active run');
  expect(() => deleteJob(board, card.id, 'scout', 'Remove')).toThrow('active run');
  expect(board.events()).toEqual(before);
  board.record(
    'run',
    { id: 'busy', cardId: card.id, status: 'completed' } as Run,
    'writer',
    'Finished',
  );
  const approval = approvals(board, card.id);
  const record = board.record.bind(board);
  vi.spyOn(board, 'record').mockImplementation((kind, ...args) => {
    if (kind === 'approval') throw new Error('Fixture write failure');
    return record(kind, ...args);
  });
  const events = board.events();
  expect(() => deleteJob(board, card.id, 'scout', 'Remove')).toThrow('Fixture write failure');
  expect(board.get<Card>('card', card.id).state).toBe('awaiting_approval');
  expect(board.get<Approval>('approval', approval.id).status).toBe('approved');
  expect(board.events()).toEqual(events);
});
