import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { JobHistoryProps } from '@/components/CardDetails/types.ts';
import { timeAgo } from '@/lib/time.ts';
import { useJobHistory, type JobHistoryEvent } from '../hooks/useJobHistory.ts';
import { historySentence, splitJobHistory } from '../history.ts';

// Every recorded event has happened, so each sits on a done bead; the newest is simply first.
type Row = { event: JobHistoryEvent; title: string };

const HistoryRows = ({ rows, nameOf }: { rows: Row[]; nameOf: (id: string) => string }) => (
  <div className="detail-history" data-beads="">
    {rows.map(({ event, title }) => (
      <div key={event.id}>
        <span className="clay-bead" data-size="sm" data-tone="done" aria-hidden="true" />
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
  const nameOf = (id: string) =>
    id === 'user'
      ? 'You'
      : id === 'orchestrator' || id === 'system'
        ? 'Pitchcrew'
        : (roleName(id) ?? id);
  const { meaningful, technical } = splitJobHistory(events);
  return (
    <div className="space-y-3">
      {meaningful.length ? (
        <HistoryRows
          nameOf={nameOf}
          rows={meaningful.map((event) => ({
            event,
            title: historySentence(event, roleName),
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
            rows={technical.map((event) => ({ event, title: event.message }))}
          />
        </AccordionSection>
      ) : null}
    </div>
  );
};
