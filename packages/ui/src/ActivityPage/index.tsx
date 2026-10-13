import { ActivityFilters } from '@/ActivityPage/components/ActivityFilters.tsx';
import { ActivityHistory } from '@/ActivityPage/components/ActivityHistory.tsx';
import { eventKindLabels } from '@/ActivityPage/constants.ts';
import { EmptyState } from '@/components/EmptyState/index.tsx';
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
    <div className="activity-workspace flex min-h-0 min-w-0 flex-1 flex-col">
      <ActivityFilters query={query} kind={kind} change={change} count={filtered.length} />
      {filtered.length ? (
        <ActivityHistory events={filtered} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState
            title={events.length ? 'No matching activity' : 'Your history starts here'}
            description={
              events.length
                ? 'Try another search or activity type.'
                : 'Your jobs, crew runs, and decisions will appear here as you work.'
            }
          />
        </div>
      )}
    </div>
  );
}
