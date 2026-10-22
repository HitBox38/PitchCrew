import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';
import { useJobHistory } from '../hooks/useJobHistory.ts';

export const JobHistory = ({ data, card }: JobHistoryProps) => {
  const { events, loading } = useJobHistory(data, card);
  if (!events.length)
    return <p className="quiet">{loading ? 'Loading history…' : 'No history yet.'}</p>;
  return (
    <div className="detail-history">
      {events.map((event) => (
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
};
