import type { BoardEvent, Card, CardState } from '@pitchcrew/core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CrewService } from '../../service.ts';
import type { IdRoute } from '../types.ts';

/** One status move or packet draft/revision read from a job's saved card events. */
export interface CardChange {
  id: number;
  at: string;
  actor: string;
  /** The status the job moved to, when this event moved it. */
  state?: CardState;
  packet?: 'drafted' | 'revised';
}

/** A newest-first page of a job's changes; `older` is the cursor for the next page. */
export interface CardChangesPage {
  changes: CardChange[];
  older: number | null;
  /** Saved time of the oldest event this page scanned. */
  reachedAt: string | null;
}

const pageSize = 200;
const movedMessage = /^(Moved to|User changed status)/;

const cardOf = (event: BoardEvent): Card | undefined => {
  const data = event.data as Card | undefined;
  return event.kind === 'card' && data && typeof data.state === 'string' ? data : undefined;
};

/**
 * Reads changes from one newest-first page of a job's events. `page` may hold one extra, older
 * event that serves only as the baseline for the oldest event in the page.
 */
export const cardChangesPage = (page: BoardEvent[]): CardChangesPage => {
  const scanned = page.slice(0, pageSize);
  const cards = page.map(cardOf);
  const changes: CardChange[] = [];
  scanned.forEach((event, index) => {
    const next = cards[index];
    if (!next) return;
    const previous = cards.slice(index + 1).find(Boolean);
    const change: CardChange = { id: event.id, at: event.createdAt, actor: event.actor };
    if (previous ? previous.state !== next.state : movedMessage.test(event.message))
      change.state = next.state;
    if (previous && next.packet && previous.packet?.resume !== next.packet.resume)
      change.packet = previous.packet ? 'revised' : 'drafted';
    if (change.state || change.packet) changes.push(change);
  });
  return {
    changes,
    older: page.length > pageSize ? scanned.at(-1)!.id : null,
    reachedAt: scanned.at(-1)?.createdAt ?? null,
  };
};

/** Job conversations read status moves and drafts older than the snapshot's recent events. */
export const registerCardChangeRoutes = (app: FastifyInstance, service: CrewService) => {
  app.get<IdRoute>('/api/cards/:id/changes', (req) => {
    const id = z.uuid().parse(req.params.id);
    const { before } = z
      .object({ before: z.coerce.number().int().positive().optional() })
      .parse(req.query);
    service.board.get<Card>('card', id);
    return cardChangesPage(service.board.history(id, before, pageSize + 1));
  });
};
