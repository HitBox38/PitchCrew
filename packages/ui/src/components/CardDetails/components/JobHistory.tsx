import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';
import { useJobHistory, type JobHistoryEvent } from '../hooks/useJobHistory.ts';
import { historySentence, splitJobHistory } from '../history.ts';

type Row = { event: JobHistoryEvent; title: string; current: boolean };

const HistoryRows = ({ rows, nameOf }: { rows: Row[]; nameOf: (id: string) => string }) => (
  <div className="detail-history" data-beads="">
    {rows.map(({ event, title, current }) => (
      <div key={event.id}>
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={current ? 'current' : 'done'}
          aria-hidden="true"
        />
        <div>
          <strong>{title}</strong>
          <p>
            {nameOf(event.actor)} · {timeAgo(event.createdAt)}
          </p>
        </div>
      </div>
    ))}
  </div>
);

/** What happened to the job first; ownership and saving steps stay in a labelled record. */
export const JobHistory = ({ data, card }: JobHistoryProps) => {
  const { events, loading } = useJobHistory(data, card);
  if (!events.length)
    return <p className="quiet">{loading ? 'Loading history…' : 'No history yet.'}</p>;
  const roleName = (id: string) => data.roles.find((role) => role.id === id)?.name;
  const nameOf = (id: string) => (id === 'user' ? 'You' : (roleName(id) ?? id));
  const { meaningful, technical } = splitJobHistory(events);
  return (
    <div className="space-y-3">
      {meaningful.length ? (
        <HistoryRows
          nameOf={nameOf}
          rows={meaningful.map((event, index) => ({
            event,
            title: historySentence(event, roleName),
            current: index === 0,
          }))}
        />
      ) : (
        <p className="quiet">No major changes yet.</p>
      )}
      {technical.length ? (
        <AccordionSection heading={<>Technical steps ({technical.length})</>}>
          <p className="quiet">
            Ownership, saving and progress records, exactly as stored. Failures always stay above.
          </p>
          <HistoryRows
            nameOf={nameOf}
            rows={technical.map((event) => ({ event, title: event.message, current: false }))}
          />
        </AccordionSection>
      ) : null}
    </div>
  );
};
