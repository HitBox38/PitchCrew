import { useState } from 'react';
import type { BoardEvent } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { groupByDay, pageSize } from '../history.ts';
import { ActivityRow } from './ActivityRow.tsx';

/** Day sections (label only; the one count is in the title) of event rows, revealed fifty at a time so long histories stay light. */
export const ActivityHistory = ({ events }: { events: BoardEvent[] }) => {
  const data = useWorkspaceStore((state) => state.data);
  const [shown, setShown] = useState(pageSize);
  if (!data) return null;
  return (
    <section className="activity-history" aria-label="Activity history">
      {groupByDay(events.slice(0, shown)).map((group) => (
        <section key={group.key} className="ui-section" aria-label={group.label}>
          <h2 className="ui-section-heading">{group.label}</h2>
          <ol className="activity-list">
            {group.events.map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                data={data}
                today={group.label === 'Today'}
              />
            ))}
          </ol>
        </section>
      ))}
      {events.length > shown ? (
        <div className="activity-more">
          <span>
            Showing {shown} of {events.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShown((count) => count + pageSize)}>
            Show more
          </Button>
        </div>
      ) : null}
    </section>
  );
};
