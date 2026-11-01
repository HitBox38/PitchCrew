import { useEffect, useState } from 'react';
import type { Card } from '@pitchcrew/core';
import { api } from '@/api.ts';
import { loadCardChanges, type CardChange, type CardChangesPage } from '@/ChatView/job-changes.ts';
import { jobTimeline } from '../helpers.ts';

const cache = new Map<string, Promise<CardChange[]>>();

const load = (card: Card) => {
  const key = `${card.id}|${card.updatedAt}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = loadCardChanges(
      (before) =>
        api<CardChangesPage>(`/cards/${card.id}/changes${before ? `?before=${before}` : ''}`),
      card.createdAt,
    );
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
    while (cache.size > 12) cache.delete(cache.keys().next().value!);
  }
  return pending;
};

/** The job's workflow track, dated from its saved history once that loads. */
export const useJobTimeline = (card: Card | undefined) => {
  const [loaded, setLoaded] = useState<{ key: string; changes: CardChange[] }>();
  const key = card ? `${card.id}|${card.updatedAt}` : undefined;
  useEffect(() => {
    if (!card || !key) return;
    let current = true;
    load(card)
      .then((changes) => {
        if (current) setLoaded({ key, changes });
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [card, key]);
  if (!card) return [];
  return jobTimeline(card, loaded && loaded.key === key ? loaded.changes : undefined);
};
