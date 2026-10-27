import {
  digestPacket,
  jobSourceRevision,
  saveApplicationContext,
  type Board,
} from '../../src/index.ts';
import type { Card } from '@pitchcrew/core';

/** Explicit user confirmation for fictional legacy test setups, never a production bypass. */
export const confirmFixtureJob = (board: Board, id: string) => {
  const card = board.get<Card>('card', id);
  if (card.applicationContext?.confirmedAt) return card;
  return saveApplicationContext(
    board,
    id,
    jobSourceRevision(card),
    card.applicationContext?.revision ?? null,
    {
      brief: {
        companyContext: 'Fictional fixture employer.',
        responsibilities: ['Build interfaces.'],
        qualifications: ['React and TypeScript.'],
        constraints: [],
      },
      requirements: [],
      flagged: [],
      ...(card.url ? { form: { status: 'manual' } } : {}),
    },
    true,
  );
};
/** Test fixtures that directly construct a reviewed packet must include its review evidence. */
export const reviewFixturePacket = (board: Board, id: string) => {
  const card = confirmFixtureJob(board, id);
  if (!card.packet) throw new Error('Fixture packet is missing.');
  const revision = card.applicationContext!.revision;
  return board.updateCard(
    id,
    {
      packetContextRevision: revision,
      packetReview: {
        contextRevision: revision,
        packetDigest: digestPacket(id, card.packet),
        runId: 'fixture-review',
        reviewedAt: new Date().toISOString(),
      },
    },
    'reviewer',
    'Recorded fictional packet review evidence',
  );
};
