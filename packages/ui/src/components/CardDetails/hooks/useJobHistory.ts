import { api } from '@/api.ts';
import type { BoardEvent, Card, Run, Snapshot } from '@pitchcrew/core';
import { useEffect, useState } from 'react';

export type JobHistoryEvent = Pick<
  BoardEvent,
  'id' | 'kind' | 'actor' | 'message' | 'createdAt'
> & {
  /** The run's status when this run event was saved; only snapshot events carry it. */
  runStatus?: Run['status'];
};

const recentEvents = (data: Snapshot, card: Card): JobHistoryEvent[] =>
  data.events
    .filter(
      (e) =>
        e.entityId === card.id ||
        (['run', 'deep_review'].includes(e.kind) &&
          (e.data as { cardId?: string }).cardId === card.id),
    )
    .map(({ id, kind, actor, message, createdAt, data: saved }) => ({
      id,
      kind,
      actor,
      message,
      createdAt,
      runStatus: kind === 'run' ? (saved as Partial<Run>).status : undefined,
    }));

/** Saved job history plus recent run events, which the card's own history does not include. */
export const useJobHistory = (data: Snapshot, card: Card) => {
  const [saved, setSaved] = useState<{ id: string; events: JobHistoryEvent[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void api<JobHistoryEvent[]>(`/cards/${card.id}/history`, 'GET', undefined, controller.signal)
      .then((events) => {
        if (controller.signal.aborted) return;
        setFailed(false);
        setSaved({ id: card.id, events });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [card.id, card.updatedAt]);
  const events = new Map<number, JobHistoryEvent>();
  for (const event of [...(saved?.id === card.id ? saved.events : []), ...recentEvents(data, card)])
    events.set(event.id, event);
  return {
    events: [...events.values()].toSorted((a, b) => b.id - a.id),
    loading: saved?.id !== card.id && !failed,
  };
};
