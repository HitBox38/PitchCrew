import {
  extractedJobSchema,
  missingPersonalAnswers,
  type Card,
  type ApplicationContext,
  type ExtractedJob,
  type Approval,
  type ComputerApproval,
  type Run,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import { createHash } from 'node:crypto';
import { digestPacket } from './helpers.ts';
import type { BoardContext } from './types.ts';
export const jobSourceRevision = (card: Card) => {
  return digest([
    card.company,
    card.title,
    card.location,
    card.salary,
    card.url,
    card.description,
    card.sourceHtml ?? null,
  ]);
};
export const applicationRevision = (sourceRevision: string, data: ExtractedJob) => {
  const parsed = extractedJobSchema.parse(data);
  return digest([sourceRevision, parsed.brief, parsed.requirements, parsed.flagged]);
};
export const assertExtractedContext = (card: Card): ApplicationContext => {
  const context = card.applicationContext;
  if (
    !context ||
    context.sourceRevision !== jobSourceRevision(card) ||
    applicationRevision(context.sourceRevision, {
      brief: context.brief,
      requirements: context.requirements,
      flagged: context.flagged,
    }) !== context.revision
  )
    throw new Error('Extract or prepare this job’s application brief first.');
  return context;
};
export const assertConfirmedContext = (card: Card): ApplicationContext => {
  const context = assertExtractedContext(card);
  if (!context.confirmedAt || context.confirmedRevision !== context.revision)
    throw new Error('Review and confirm this job’s application brief before drafting.');
  return context;
};
export const assertReviewedContext = (card: Card) => {
  const context = assertConfirmedContext(card);
  if (missingPersonalAnswers(context).length)
    throw new Error(
      'Answer the required personal application questions before this packet can be Ready.',
    );
  if (
    !card.packet ||
    card.packetContextRevision !== context.revision ||
    card.packetReview?.contextRevision !== context.revision ||
    card.packetReview.packetDigest !== digestPacket(card.id, card.packet)
  )
    throw new Error('This packet needs a fresh review against the confirmed application brief.');
  return context;
};
export const saveApplicationContext = (
  board: Pick<BoardContext, 'get' | 'record' | 'hasActiveRun' | 'db' | 'list'>,
  cardId: string,
  expectedSource: string,
  expectedRevision: string | null,
  data: unknown,
  confirm: boolean,
): Card => {
  const extracted = extractedJobSchema.parse(data);
  return board.db.transaction(() => {
    const card = board.get<Card>('card', cardId);
    if (card.deletedAt) throw new Error('This job was deleted.');
    if (board.hasActiveRun(cardId))
      throw new Error('Wait for the active application run to finish.');
    if (
      board.list<Run>('run').some((run) => run.cardId === cardId && run.status === 'running') ||
      board
        .list<SubmissionAttempt>('submission_attempt')
        .some((attempt) => attempt.cardId === cardId && attempt.status === 'uncertain')
    )
      throw new Error(
        'Finish or cancel active job work and resolve uncertain submissions before changing the application brief.',
      );
    if (
      jobSourceRevision(card) !== expectedSource ||
      (card.applicationContext?.revision ?? null) !== expectedRevision
    )
      throw new Error('The job or brief changed. Review its current version.');
    const revision = applicationRevision(expectedSource, extracted);
    const same = card.applicationContext?.revision === revision;
    const now = new Date().toISOString();
    const applicationContext: ApplicationContext = {
      ...extracted,
      sourceRevision: expectedSource,
      revision,
      visibility: 'unknown',
      createdAt: now,
      provenance: confirm ? 'user' : 'extraction',
      ...(confirm
        ? { confirmedAt: now, confirmedRevision: revision }
        : same && card.applicationContext?.confirmedAt
          ? {
              confirmedAt: card.applicationContext.confirmedAt,
              confirmedRevision: revision,
            }
          : {}),
    };
    const next: Card = {
      ...card,
      applicationContext,
      updatedAt: now,
      ...(!same ? { packetReview: undefined, packetFit: undefined } : {}),
    };
    board.record(
      'card',
      next,
      confirm ? 'user' : 'orchestrator',
      confirm
        ? 'Confirmed application brief and requirements'
        : 'Extracted application brief for user review',
    );
    if (!same) {
      for (const approval of board.list<Approval>('approval'))
        if (approval.cardId === cardId && ['pending', 'approved'].includes(approval.status))
          board.record(
            'approval',
            { ...approval, status: 'rejected', decidedAt: now },
            'user',
            'Invalidated export approval after application context changed',
          );
      for (const approval of board.list<ComputerApproval>('computer_approval'))
        if (approval.cardId === cardId && ['pending', 'approved'].includes(approval.status))
          board.record(
            'computer_approval',
            { ...approval, status: 'rejected', decidedAt: now },
            'user',
            'Invalidated browser approval after application context changed',
          );
    }
    return next;
  })();
};

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
