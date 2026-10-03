import {
  assertTransition,
  type Card,
  type CardInput,
  type CardState,
  type Run,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';
import type { BoardContext } from './types.ts';

export function createCard(this: BoardContext, input: CardInput, sample: boolean = false): Card {
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
  this.record('card', card, 'user', `Added ${card.company} to the board`);
  return card;
}
export function updateCard(
  this: BoardContext,
  id: string,
  patch: Partial<
    Pick<Card, 'packet' | 'feedback' | 'fit' | 'owner' | 'formAssessments' | 'submissionAttempts'>
  >,
  actor: string,
  message: string,
): Card {
  const card = { ...this.get<Card>('card', id), ...patch, updatedAt: new Date().toISOString() };
  this.record('card', card, actor, message);
  return card;
}
export function move(
  this: BoardContext,
  id: string,
  state: CardState,
  actor: string,
  message?: string,
): Card {
  const card = this.get<Card>('card', id);
  assertTransition(card.state, state);
  const now = new Date().toISOString();
  const next = {
    ...card,
    state,
    updatedAt: now,
    ...(actor === 'user' ? { statusEffectiveAt: now } : {}),
  };
  this.record('card', next, actor, message ?? `Moved to ${state.replaceAll('_', ' ')}`);
  return next;
}
export function hasActiveRun(this: BoardContext, cardId: string): boolean {
  return this.list<Run>('run').some(
    (run) => run.cardId === cardId && run.status === 'running' && run.mode !== 'chat',
  );
}
