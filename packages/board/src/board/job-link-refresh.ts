import {
  canonicalJobUrl,
  type Card,
  type CardInput,
  type JobLinkProvenance,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { Board } from '../index.ts';
import { jobSourceRevision } from './application-context.ts';
import { assertJobDetailsChange, recordJobSourceChange } from './job-details.ts';
import { postingMatches, recordLinkedJob } from './discovery.ts';
import { isLikelyDuplicateApplication } from './tracking.ts';

export { assertJobDetailsChange as assertJobLinkRefresh } from './job-details.ts';

export interface SaveJobLinkOptions {
  input: CardInput;
  actor: string;
  pastedUrl: string;
  provenance?: JobLinkProvenance;
  target?: { cardId: string; runId: string; expectedSource: string };
}

/** Duplicate check, refresh and approval invalidation commit as a single unit. */
export const saveReadJobLink = (board: Board, options: SaveJobLinkOptions) => {
  return board.db.transaction(() => {
    const { input, actor, pastedUrl, provenance, target } = options;
    const duplicates = (
      provenance
        ? postingMatches(board, {
            provider: provenance.provider,
            slug: provenance.board,
            jobId: provenance.jobId,
            company: input.company,
            title: input.title,
            urls: [input.url, pastedUrl],
          })
        : board
            .list<Card>('card')
            .filter(
              (card) =>
                canonicalJobUrl(card.url) === canonicalJobUrl(pastedUrl) ||
                isLikelyDuplicateApplication(card, { ...input, jobIdentifier: '' }),
            )
    ).filter((card) => card.id !== target?.cardId);
    if (duplicates.length) return { card: null, duplicates };
    if (target)
      return {
        card: refreshJobLink(board, {
          ...target,
          input,
          actor,
          ...(provenance ? { provenance } : {}),
        }),
        duplicates: [],
      };
    if (provenance)
      return { card: recordLinkedJob(board, input, provenance, actor), duplicates: [] };
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
      sample: false,
    };
    board.record('card', card, actor, 'Added job from a public posting link');
    return { card, duplicates: [] };
  })();
};

/** Caller holds the save transaction, including its duplicate check. */
const refreshJobLink = (
  board: Board,
  options: {
    cardId: string;
    runId: string;
    expectedSource: string;
    input: CardInput;
    actor: string;
    provenance?: JobLinkProvenance;
  },
): Card => {
  const { cardId, runId, expectedSource, input, actor, provenance } = options;
  const card = assertJobDetailsChange(board, cardId, runId);
  if (jobSourceRevision(card) !== expectedSource)
    throw new Error('The job changed while reading the link. Read it again before updating.');
  const now = new Date().toISOString();
  const next: Card = {
    ...card,
    company: input.company,
    title: input.title,
    url: input.url,
    location: input.location || card.location,
    salary: input.salary || card.salary,
    description: input.description || card.description,
    sourceHtml: input.sourceHtml,
    ...(provenance
      ? {
          discovery: {
            provider: provenance.provider,
            sourceId: 'link',
            sourceName: provenance.board,
            slug: provenance.board,
            jobId: provenance.jobId,
            postedAt: provenance.postedAt,
            firstSeenAt: card.discovery?.firstSeenAt ?? now,
          },
          tracking: {
            origin: 'pitchcrew',
            gmailThreads: [],
            ...card.tracking,
            jobIdentifier: provenance.jobId,
          },
        }
      : { discovery: undefined }),
  };
  return recordJobSourceChange(
    board,
    card,
    next,
    actor,
    'Updated job details from a posting link; application brief needs fresh review',
  );
};
