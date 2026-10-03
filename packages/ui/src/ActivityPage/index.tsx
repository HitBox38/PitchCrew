import { ActivityFilters } from '@/ActivityPage/components/ActivityFilters.tsx';
import { actorLabels, eventKindLabels } from '@/ActivityPage/constants.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
import { timeAgo } from '@/lib/time.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { useNavigate, useSearch } from '@tanstack/react-router';

export function ActivityPage() {
  const events = useWorkspaceStore((state) => state.data?.events);
  const search = useSearch({ from: '/activity' });
  const navigate = useNavigate({ from: '/activity' });
  const query = search.q ?? '';
  const kind = search.kind ?? 'all';
  if (!events) return null;
  const filtered = events.filter(
    (event) =>
      (kind === 'all' || event.kind === kind) &&
      `${event.message} ${event.actor} ${eventKindLabels[event.kind]}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const change = (q: string, nextKind: string) => {
    void navigate({
      search: {
        q: q || undefined,
        kind: nextKind === 'all' ? undefined : (nextKind as keyof typeof eventKindLabels),
      },
      replace: true,
    });
  };
  return (
    <>
      <ActivityFilters query={query} kind={kind} change={change} count={filtered.length} />
      {filtered.length ? (
        <section className="activity-panel" aria-label="Activity history">
          <ol className="activity-list">
            {filtered.map((event) => (
              <li className={`activity-row ${event.kind}`} key={event.id}>
                <time dateTime={event.createdAt} title={event.createdAt}>
                  {timeAgo(event.createdAt)}
                </time>
                <span className="activity-message">{event.message}</span>
                <span className="activity-actor">
                  {actorLabels[event.actor] ?? event.actor}
                  <span className="activity-kind">{eventKindLabels[event.kind]}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <EmptyState
          title={events.length ? 'No matching activity' : 'Your history starts here'}
          description={
            events.length
              ? 'Try another search or activity type.'
              : 'Your jobs, crew runs, and decisions will appear here as you work.'
          }
        />
      )}
    </>
  );
}
