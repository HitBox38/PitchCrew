import { api } from '@/api.ts';
import type { Card } from '@pitchcrew/core';
import { useEffect, useState } from 'react';

/** Source text is local to the opened job and released when its sheet closes. */
export function useCardSource(card: Card, compact: boolean) {
  const [source, setSource] = useState<{
    id: string;
    description: string;
    sourceHtml?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!compact) return;
    const controller = new AbortController();
    void api<Card>(`/cards/${card.id}`, 'GET', undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setError('');
          setSource({
            id: result.id,
            description: result.description,
            sourceHtml: result.sourceHtml,
          });
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Could not load this job.');
      });
    return () => controller.abort();
  }, [compact, card.id, card.updatedAt, attempt]);
  const ready = !compact || source?.id === card.id;
  return {
    card:
      compact && source?.id === card.id
        ? { ...card, description: source.description, sourceHtml: source.sourceHtml }
        : card,
    ready,
    error,
    retry: () => {
      setError('');
      retry((value) => value + 1);
    },
  };
}
