import { cardInput, type Card, type ComputerApproval } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { assertReviewedContext, Board, updateJobDetails } from '../src/index.ts';
import { reviewFixturePacket } from './fixtures/application-context.ts';
import { packet } from './fixtures/packet.ts';

const context = () => {
  const board = new Board(':memory:');
  boards.push(board);
  const initial = board.createCard(
    cardInput.parse({
      company: 'Wrong Fixture',
      title: 'Engineer',
      location: 'Remote',
      salary: 'Saved salary',
      url: 'https://example.com/jobs/engineer',
      description: 'Saved posting',
      sourceHtml: '<p>Saved posting</p>',
      tags: ['saved'],
    }),
  );
  board.record(
    'card',
    {
      ...initial,
      state: 'agreed',
      packet,
      weight: 2,
      lessons: [{ id: 'lesson', text: 'Keep this user note', createdAt: initial.createdAt }],
      tracking: { origin: 'external', note: 'Keep tracking', gmailThreads: [] },
    },
    'user',
    'Fixture',
  );
  reviewFixturePacket(board, initial.id);
  const approval = board.requestApproval(initial.id);
  board.decideApproval(approval.id, true);
  board.record(
    'computer_approval',
    { id: 'browser', cardId: initial.id, status: 'approved', decidedAt: null } as ComputerApproval,
    'user',
    'Fixture',
  );
  const card = board.get<Card>('card', initial.id);
  const correct = (changes: unknown) =>
    updateJobDetails(board, card.id, changes, 'scout', 'chat', 'User correction');
  return { board, card, approval, correct };
};

const boards: Board[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const board of boards.splice(0)) board.close();
});

it('invalidates context-dependent evidence and approvals while preserving the card, files and bookkeeping', () => {
  const { board, card, approval, correct } = context();
  const saved = correct({ company: 'Correct Fixture' });
  expect(saved).toEqual({
    ...card,
    company: 'Correct Fixture',
    updatedAt: expect.any(String),
    fit: null,
    applicationContext: undefined,
    packetContextRevision: undefined,
    packetReview: undefined,
    formAssessments: undefined,
  });
  expect(() => assertReviewedContext(saved)).toThrow('brief first');
  expect(board.get<{ status: string }>('approval', approval.id).status).toBe('rejected');
  expect(board.get<{ status: string }>('computer_approval', 'browser').status).toBe('rejected');
  expect(board.history(card.id)[0]).toMatchObject({ actor: 'scout', message: 'User correction' });
  board.rebuild();
  expect(board.get<Card>('card', card.id)).toEqual(JSON.parse(JSON.stringify(saved)));
});

it('keeps identical corrections idempotent without invalidating an existing review or approval', () => {
  const { board, card, correct } = context();
  const events = board.events();
  expect(correct({ company: `  ${card.company}  ` })).toEqual(card);
  expect(board.events()).toEqual(events);
});

it('rolls back the card and export approval if browser approval invalidation fails', () => {
  const { board, card, correct } = context();
  const events = board.events();
  const record = board.record.bind(board);
  vi.spyOn(board, 'record').mockImplementation((...args) => {
    if (args[0] === 'computer_approval') throw new Error('Fixture approval failure');
    return record(...args);
  });
  expect(() => correct({ company: 'Correct Fixture' })).toThrow('approval failure');
  expect(board.get<Card>('card', card.id)).toEqual(card);
  expect(board.events()).toEqual(events);
});

it('updates only supplied fields, including explicitly clearing optional details', () => {
  const { card, correct } = context();
  const saved = correct({ title: 'Senior Engineer', location: '', salary: '' });
  expect(saved).toMatchObject({
    company: card.company,
    title: 'Senior Engineer',
    location: '',
    salary: '',
    url: card.url,
    description: card.description,
    sourceHtml: card.sourceHtml,
    tags: card.tags,
  });
});
