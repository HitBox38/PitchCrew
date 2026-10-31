import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';
import { useJobHistory } from '../hooks/useJobHistory.ts';
import { useDevicePreferences } from '@/lib/device-preferences.ts';

export const JobHistory = ({ data, card }: JobHistoryProps) => {
  const { events, loading } = useJobHistory(data, card);
  const clay = useDevicePreferences((state) => state.clayInterface);
  if (!events.length)
    return <p className="quiet">{loading ? 'Loading history…' : 'No history yet.'}</p>;
  return (
    <div className="detail-history" data-beads={clay ? '' : undefined}>
      {events.map((event, index) => (
        <div key={event.id}>
          {clay ? (
            <span
              className="clay-bead"
              data-size="sm"
              data-tone={index === 0 ? 'plum' : 'done'}
              aria-hidden="true"
            />
          ) : (
            <span className="history-dot" />
          )}
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
