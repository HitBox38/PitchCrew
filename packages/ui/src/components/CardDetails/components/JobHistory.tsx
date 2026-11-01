import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';
import { useJobHistory } from '../hooks/useJobHistory.ts';

export const JobHistory = ({ data, card }: JobHistoryProps) => {
  const { events, loading } = useJobHistory(data, card);
  if (!events.length)
    return <p className="quiet">{loading ? 'Loading history…' : 'No history yet.'}</p>;
  return (
    <div className="detail-history" data-beads="">
      {events.map((event, index) => (
        <div key={event.id}>
          <span
            className="clay-bead"
            data-size="sm"
            data-tone={index === 0 ? 'current' : 'done'}
            aria-hidden="true"
          />
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
};
