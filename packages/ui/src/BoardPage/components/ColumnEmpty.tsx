import { Button } from '@pitchcrew/design-system/button';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';

/** A filtered column offers Clear search; an empty one says what lands there. */
export const ColumnEmpty = ({ query, empty }: { query: string; empty: string }) => {
  const setQuery = useWorkspaceStore((state) => state.setQuery);
  return query.trim() ? (
    <p className="clay-column-empty">
      No jobs match.
      <Button variant="link" size="xs" onClick={() => setQuery('')}>
        Clear search
      </Button>
    </p>
  ) : (
    <p className="clay-column-empty">{empty}</p>
  );
};
