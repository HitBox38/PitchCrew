import {
  assertTransition,
  type Card,
  type CardInput,
  type CardState,
  type Run,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { BoardContext } from './types.ts';

export const createCard = (
  context: BoardContext,
  input: CardInput,
  sample: boolean = false,
  actor = 'user',
): Card => {
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
    sample,
  };
  context.record('card', card, actor, `Added ${card.company} to the board`);
  return card;
};
export const updateCard = (
  context: BoardContext,
  id: string,
  patch: Partial<
    Pick<
      Card,
      | 'packet'
      | 'feedback'
      | 'fit'
      | 'packetFit'
      | 'owner'
      | 'formAssessments'
      | 'submissionAttempts'
      | 'applicationContext'
      | 'packetContextRevision'
      | 'packetReview'
    >
  >,
  actor: string,
  message: string,
): Card => {
  const previous = context.get<Card>('card', id);
  const card = { ...previous, ...patch, updatedAt: new Date().toISOString() };
  if (
    JSON.stringify(previous.packet) !== JSON.stringify(card.packet) ||
    previous.applicationContext?.revision !== card.applicationContext?.revision
  )
    card.packetFit = undefined;
  context.record('card', card, actor, message);
  return card;
};
export const move = (
  context: BoardContext,
  id: string,
  state: CardState,
  actor: string,
  message?: string,
): Card => {
  const card = context.get<Card>('card', id);
  assertTransition(card.state, state);
  const now = new Date().toISOString();
  const next = {
    ...card,
    state,
    updatedAt: now,
    ...(actor === 'user' ? { statusEffectiveAt: now } : {}),
  };
  context.record('card', next, actor, message ?? `Moved to ${state.replaceAll('_', ' ')}`);
  return next;
};
export const hasActiveRun = (context: BoardContext, cardId: string): boolean => {
  return context
    .list<Run>('run')
    .some((run) => run.cardId === cardId && run.status === 'running' && run.mode !== 'chat');
};
