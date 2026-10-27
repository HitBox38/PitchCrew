import {
  cardInput,
  type Approval,
  type Card,
  type ComputerApproval,
  type Run,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import { afterEach, expect, it } from 'vitest';
import { Board, digestPacket, editJob } from '../src/index.ts';
import { reviewFixturePacket } from './fixtures/application-context.ts';
import { packet } from './fixtures/packet.ts';

const boards: Board[] = [];
afterEach(() => boards.splice(0).forEach((board) => board.close()));
const context = () => {
  const board = new Board(':memory:');
  boards.push(board);
  const initial = board.createCard(
    cardInput.parse({
      company: 'Fictional Studio',
      title: 'Engineer',
      description: 'Saved posting',
      sourceHtml: '<p>Saved posting</p>',
      url: 'https://example.com/job',
      tags: ['saved'],
    }),
  );
  board.record(
    'card',
    {
      ...initial,
      state: 'agreed',
      packet,
      fit: 80,
      tracking: { origin: 'external', note: 'Keep tracking', gmailThreads: [] },
      weight: 2,
      lessons: [{ id: 'lesson', text: 'Keep note', createdAt: initial.createdAt }],
    },
    'user',
    'Fixture',
  );
  const reviewed = reviewFixturePacket(board, initial.id);
  board.updateCard(
    initial.id,
    {
      packetFit: {
        score: 85,
        reasons: ['The packet addresses the fictional role.'],
        fitReasons: ['Relevant fictional experience.'],
        packetDigest: digestPacket(initial.id, packet),
        contextRevision: reviewed.applicationContext!.revision,
        runId: 'fixture-evaluation',
        evaluatedAt: reviewed.updatedAt,
      },
    },
    'scout',
    'Recorded fictional packet match',
  );
  const approval = board.requestApproval(initial.id);
  board.decideApproval(approval.id, true);
  board.record(
    'computer_approval',
    { id: 'browser', cardId: initial.id, status: 'approved' } as ComputerApproval,
    'user',
    'Fixture',
  );
  const card = board.get<Card>('card', initial.id);
  const input = {
    company: card.company,
    title: card.title,
    location: card.location,
    salary: card.salary,
    url: card.url,
    description: card.description,
    tags: card.tags,
    expectedUpdatedAt: card.updatedAt,
  };
  return { board, card, input, approval };
};
it('saves all user fields, clears stale source evidence and retains bookkeeping, files and history', () => {
  const { board, card, input, approval } = context();
  const saved = editJob(board, card.id, {
    ...input,
    company: 'Updated Studio',
    title: 'Senior Engineer',
    location: '',
    salary: '$100k',
    url: '',
    description: 'Updated posting',
    tags: ['updated'],
  });
  expect(saved).toEqual({
    ...card,
    company: 'Updated Studio',
    title: 'Senior Engineer',
    location: '',
    salary: '$100k',
    url: '',
    description: 'Updated posting',
    tags: ['updated'],
    sourceHtml: undefined,
    fit: null,
    packetFit: undefined,
    applicationContext: undefined,
    packetContextRevision: undefined,
    packetReview: undefined,
    formAssessments: undefined,
    updatedAt: expect.any(String),
  });
  expect(board.get<Approval>('approval', approval.id).status).toBe('rejected');
  expect(board.get<ComputerApproval>('computer_approval', 'browser').status).toBe('rejected');
  expect(board.history(card.id)[0]).toMatchObject({
    actor: 'user',
    message: 'User edited the job',
  });
  board.rebuild();
  expect(board.get<Card>('card', card.id)).toEqual(JSON.parse(JSON.stringify(saved)));
});
it('keeps identical edits as a no-op and tag-only edits preserve reviewed evidence and approvals', () => {
  const { board, card, input, approval } = context();
  expect(card.packetFit?.score).toBe(85);
  const events = board.events();
  expect(editJob(board, card.id, { ...input, company: ` ${input.company} ` })).toEqual(card);
  expect(board.events()).toEqual(events);
  const tagged = editJob(board, card.id, { ...input, tags: [] });
  expect(tagged).toEqual({ ...card, tags: [], updatedAt: expect.any(String) });
  expect(board.get<Approval>('approval', approval.id).status).toBe('approved');
  expect(board.get<ComputerApproval>('computer_approval', 'browser').status).toBe('approved');
});
it.each(['running', 'owned', 'uncertain', 'deleted', 'stale'] as const)(
  'rejects %s edits atomically',
  (kind) => {
    const { board, card, input } = context();
    if (kind === 'running')
      board.record(
        'run',
        { id: 'busy', cardId: card.id, status: 'running', mode: 'chat' } as Run,
        'scout',
        'Busy',
      );
    if (kind === 'owned') board.record('card', { ...card, owner: 'writer' }, 'writer', 'Busy');
    if (kind === 'uncertain')
      board.record(
        'submission_attempt',
        { id: 'uncertain', cardId: card.id, status: 'uncertain' } as SubmissionAttempt,
        'user',
        'Uncertain',
      );
    if (kind === 'deleted')
      board.record('card', { ...card, deletedAt: card.createdAt }, 'user', 'Deleted');
    const events = board.events();
    expect(() =>
      editJob(board, card.id, {
        ...input,
        company: 'Edited',
        ...(kind === 'stale' ? { expectedUpdatedAt: '2020-01-01T00:00:00.000Z' } : {}),
      }),
    ).toThrow();
    expect(board.events()).toEqual(events);
  },
);
it('validates field lengths, URLs and user-editable fields before mutation', () => {
  const { board, card, input } = context();
  const events = board.events();
  for (const invalid of [
    { company: '' },
    { url: 'javascript:alert(1)' },
    { description: 'x'.repeat(20001) },
    { state: 'submitted' },
    { sourceHtml: '<p>unreviewed</p>' },
    { tags: Array(11).fill('tag') },
  ]) {
    expect(() => editJob(board, card.id, { ...input, ...invalid })).toThrow();
  }
  expect(board.events()).toEqual(events);
});
