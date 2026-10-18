import { cardInput, states, type Card, type JobLinkProvenance } from '@pitchcrew/core';
import { afterEach, expect, it, vi } from 'vitest';
import { Board, postingMatches, recordLinkedJobIfNew } from '../src/index.ts';

const boards: Board[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const board of boards.splice(0)) board.close();
});
const input = cardInput.parse({
  company: 'Northwind Labs',
  title: 'Engineer',
  url: 'https://job-boards.greenhouse.io/northwindlabs/jobs/4010001001',
});
const link: JobLinkProvenance = {
  provider: 'greenhouse',
  board: 'northwindlabs',
  jobId: '4010001001',
  postedAt: null,
};
function setup() {
  const board = new Board(':memory:');
  boards.push(board);
  return board;
}

it('rechecks duplicates even when an earlier posting lookup found none', () => {
  const board = setup();
  expect(
    postingMatches(board, {
      provider: link.provider,
      slug: link.board,
      jobId: link.jobId,
      company: input.company,
      title: input.title,
      urls: [input.url],
    }),
  ).toEqual([]);
  // Another user or run saved this posting after the lookup and before the import commit.
  const existing = board.createCard(input);
  const events = board.events();
  const result = recordLinkedJobIfNew(board, input, link, 'scout', input.url);
  expect(result).toEqual({ card: null, duplicates: [existing] });
  expect(board.events()).toEqual(events);
});

it.each(states)('leaves an existing %s card unchanged', (state) => {
  const board = setup();
  const created = board.createCard(input);
  const existing: Card = { ...created, state };
  board.record('card', existing, 'user', 'Fixture status');
  const events = board.events();
  expect(recordLinkedJobIfNew(board, input, link, 'scout', input.url)).toEqual({
    card: null,
    duplicates: [existing],
  });
  expect(board.events()).toEqual(events);
  expect(board.get<Card>('card', existing.id)).toEqual(existing);
});

it('rolls back the event and projection if the import commit fails', () => {
  const board = setup();
  const record = board.record.bind(board);
  vi.spyOn(board, 'record').mockImplementation((...args) => {
    record(...args);
    throw new Error('Fixture commit failure');
  });
  expect(() => recordLinkedJobIfNew(board, input, link, 'scout', input.url)).toThrow(
    'commit failure',
  );
  expect(board.events()).toEqual([]);
  expect(board.list('card')).toEqual([]);
  board.rebuild();
  expect(board.list('card')).toEqual([]);
});

it('invalidates source-dependent evidence and unused approvals atomically while preserving the packet', async () => {
  const { jobSourceRevision, saveReadJobLink, assertReviewedContext } =
    await import('../src/index.ts');
  const { reviewFixturePacket } = await import('./fixtures/application-context.ts');
  const { packet } = await import('./fixtures/packet.ts');
  const board = setup();
  const card = board.createCard(input);
  board.record('card', { ...card, state: 'agreed', packet }, 'user', 'Fixture');
  const ready = reviewFixturePacket(board, card.id);
  const approval = board.requestApproval(card.id);
  board.decideApproval(approval.id, true);
  board.record(
    'computer_approval',
    {
      id: 'browser',
      cardId: card.id,
      status: 'approved',
      decidedAt: null,
    } as import('@pitchcrew/core').ComputerApproval,
    'user',
    'Fixture',
  );
  const saved = saveReadJobLink(board, {
    input: { ...input, description: 'New posting details' },
    actor: 'scout',
    pastedUrl: input.url,
    provenance: link,
    target: { cardId: card.id, runId: 'chat', expectedSource: jobSourceRevision(ready) },
  }).card!;
  expect(saved).toMatchObject({ id: card.id, state: 'awaiting_approval', packet, fit: null });
  expect(saved.applicationContext).toBeUndefined();
  expect(saved.packetReview).toBeUndefined();
  expect(saved.packetContextRevision).toBeUndefined();
  expect(() => assertReviewedContext(saved)).toThrow('brief first');
  expect(board.get<{ status: string }>('approval', approval.id).status).toBe('rejected');
  expect(board.get<{ status: string }>('computer_approval', 'browser').status).toBe('rejected');
  board.rebuild();
  expect(board.get<Card>('card', card.id)).toEqual(JSON.parse(JSON.stringify(saved)));
});

it('rolls back a refresh when approval invalidation fails', async () => {
  const { jobSourceRevision, saveReadJobLink } = await import('../src/index.ts');
  const board = setup();
  const card = board.createCard(input);
  board.record(
    'computer_approval',
    {
      id: 'browser',
      cardId: card.id,
      status: 'approved',
      decidedAt: null,
    } as import('@pitchcrew/core').ComputerApproval,
    'user',
    'Fixture',
  );
  const events = board.events();
  const record = board.record.bind(board);
  vi.spyOn(board, 'record').mockImplementation((...args) => {
    if (args[0] === 'computer_approval') throw new Error('Fixture approval failure');
    return record(...args);
  });
  expect(() =>
    saveReadJobLink(board, {
      input: { ...input, description: 'New posting details' },
      actor: 'scout',
      pastedUrl: input.url,
      target: { cardId: card.id, runId: 'chat', expectedSource: jobSourceRevision(card) },
    }),
  ).toThrow('approval failure');
  expect(board.get<Card>('card', card.id)).toEqual(card);
  expect(board.events()).toEqual(events);
});
