import { api } from '@/api.ts';
import { useEffect, useState } from 'react';
import { changeEvents, loadCardChanges, type CardChangesPage } from '../job-changes.ts';
import type { JobEvent } from '../job-events.ts';

/** Loaded change lists by card, card revision and conversation start; a few recent entries. */
const cache = new Map<string, Promise<JobEvent[]>>();
const CACHE_LIMIT = 12;

const load = (cardId: string, key: string, since: string) => {
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const pending = loadCardChanges(
    (before) =>
      api<CardChangesPage>(`/cards/${cardId}/changes${before ? `?before=${before}` : ''}`),
    since,
  ).then(changeEvents);
  cache.set(key, pending);
  // A failed load is forgotten, so the next card revision or mount retries it.
  pending.catch(() => cache.delete(key));
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return pending;
};

/**
 * Status moves and drafts from a job's own saved history, loaded on demand for a job
 * conversation and reloaded when the card changes. The previous result for the same card stays
 * visible while a newer revision loads; nothing loads without a card.
 */
export const useJobChanges = (
  card: { id: string; updatedAt: string } | undefined,
  since: string | undefined,
) => {
  const [loaded, setLoaded] = useState<{ cardId: string; events: JobEvent[] }>();
  const cardId = card?.id;
  const key = card && since ? `${card.id}|${card.updatedAt}|${since}` : undefined;
  useEffect(() => {
    if (!cardId || !key || !since) return;
    let current = true;
    load(cardId, key, since)
      .then((events) => {
        if (current) setLoaded({ cardId, events });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [cardId, key, since]);
  return loaded && loaded.cardId === cardId ? loaded.events : undefined;
};
