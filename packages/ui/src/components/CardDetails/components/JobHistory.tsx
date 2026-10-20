import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';

export function JobHistory({ data, card }: JobHistoryProps) {
  return (
    <div className="detail-history">
      {data.events
        .filter(
          (e) =>
            e.entityId === card.id ||
            (['run', 'deep_review'].includes(e.kind) &&
              (e.data as { cardId?: string }).cardId === card.id),
        )
        .map((event) => (
          <div key={event.id}>
            <span className="history-dot" />
            <div>
              <strong>{event.message}</strong>
              <p>
                {data.roles.find((role) => role.id === event.actor)?.name ?? event.actor} ·{' '}
                {timeAgo(event.createdAt)}
              </p>
            </div>
          </div>
        ))}
    </div>
  );
}
