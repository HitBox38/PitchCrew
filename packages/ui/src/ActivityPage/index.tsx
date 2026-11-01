import { useNavigate, useSearch } from '@tanstack/react-router';
import { WorkspaceHeaderActions, WorkspaceHeaderFact } from '@/App/components/WorkspacePage.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { ActivityFilters } from './components/ActivityFilters.tsx';
import { ActivityHistory } from './components/ActivityHistory.tsx';
import type { eventKindLabels } from './constants.ts';
import { filterEvents } from './history.ts';
import { activitySentence } from './labels.ts';

/** What changed, newest first, grouped by day; search and type filter live in the URL. */
export const ActivityPage = () => {
  const events = useWorkspaceStore((state) => state.data?.events);
  const roles = useWorkspaceStore((state) => state.data?.roles);
  const conversations = useWorkspaceStore((state) => state.data?.conversations);
  const search = useSearch({ from: '/activity' });
  const navigate = useNavigate({ from: '/activity' });
  const query = search.q ?? '';
  const kind = search.kind ?? 'all';
  if (!events) return null;
  const nameOf = (id: string) => roles?.find((role) => role.id === id)?.name;
  const titleOf = (id: string) => conversations?.find((item) => item.id === id)?.title;
  const filtered = filterEvents(events, query, kind, (event) =>
    activitySentence(event, nameOf, titleOf),
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
  const count = `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
  return (
    <section className="activity-page" aria-label="Activity">
      <WorkspaceHeaderFact>
        <output aria-live="polite" aria-atomic="true">
          {filtered.length === events.length ? count : `${count} of ${events.length}`}
        </output>
      </WorkspaceHeaderFact>
      <WorkspaceHeaderActions>
        <ActivityFilters query={query} kind={kind} change={change} />
      </WorkspaceHeaderActions>
      {filtered.length ? (
        <ActivityHistory key={`${query}\n${kind}`} events={filtered} />
      ) : events.length ? (
        <p className="ui-empty">
          No activity matches these filters.
          <Button variant="ghost" size="sm" onClick={() => change('', 'all')}>
            Clear filters
          </Button>
        </p>
      ) : (
        <p className="ui-empty">No activity yet. Jobs, crew runs and decisions appear here.</p>
      )}
    </section>
  );
};
