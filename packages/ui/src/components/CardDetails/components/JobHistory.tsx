import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';

export function JobHistory({ data, card }: JobHistoryProps) {
  return (
    <div className="detail-history">
      {data.events
        .filter(
          (e) =>
            e.entityId === card.id ||
            (e.kind === 'run' && (e.data as { cardId?: string }).cardId === card.id),
        )
        .map((event) => (
          <div key={event.id}>
            <span className="history-dot" />
            <div>
              <strong>{event.message}</strong>
              <p>
                {event.actor} · {timeAgo(event.createdAt)}
              </p>
            </div>
          </div>
        ))}
    </div>
  );
}
