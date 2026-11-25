import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import { api } from '@/api.ts';
import { ApiHttpError } from '@/api-errors.ts';
import type { FitSend } from './bulk.ts';

/**
 * Queues one Evaluate fit on one job through the single action's endpoint. `repeat` stays unset,
 * so a retry after an unclear network failure gets the existing request back instead of a second.
 */
export const queueFit = (cardId: string) =>
  api<ChatRequest>('/queue/actions', 'POST', { cardId, action: 'fit' });

/**
 * Sends the batch one call at a time, in selection order, through `api` rather than the store's
 * action (which would reload and toast for every job). The server answers a duplicate with the
 * existing request, the same 202 and no flag, so a returned id that was already in the job's queue
 * before the call means "already queued". An HTTP error is the daemon refusing the job; any other
 * failure (the network, a reply that cannot be read) may come after the daemon queued it, so that
 * call keeps the queue's request ids from before it for the batch to check against the refreshed
 * snapshot. `current` reads the freshest snapshot before each call; `progress` hears how many
 * calls have finished.
 */
export const sendFits = async (
  cardIds: readonly string[],
  current: () => Snapshot | null,
  progress: (done: number) => void,
) => {
  const sent = new Map<string, FitSend>();
  for (const [done, cardId] of cardIds.entries()) {
    progress(done);
    const queue = current()?.queue?.queues.find((entry) => entry.id === `job:${cardId}`);
    const before = new Set(queue?.requests.map((request) => request.id));
    try {
      const request = await queueFit(cardId);
      sent.set(cardId, {
        kind: before.has(request.id) ? 'existing' : 'queued',
        requestId: request.id,
      });
    } catch (error) {
      sent.set(
        cardId,
        error instanceof ApiHttpError
          ? { kind: 'error', message: error.message }
          : { kind: 'unanswered', before: [...before] },
      );
    }
  }
  progress(cardIds.length);
  return sent;
};
