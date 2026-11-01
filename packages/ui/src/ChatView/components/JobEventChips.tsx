import type { JobEvent } from '../job-events.ts';

/** Job changes that happened at this point of a job conversation. */
export const JobEventChips = ({
  events,
  name,
}: {
  events: JobEvent[];
  name: (id: string) => string;
}) => (
  <ul className="clay-job-events" aria-label="Job updates">
    {events.map((event) => (
      <li
        key={event.id}
        className="clay-job-event"
        title={`${event.actor && event.actor !== 'user' ? `${name(event.actor)} · ` : ''}${new Date(event.at).toLocaleString()}`}
      >
        <span className="clay-bead" data-size="sm" data-tone={event.tone} aria-hidden="true" />
        <span>{event.label}</span>
        <time className="sr-only" dateTime={event.at}>
          {new Date(event.at).toLocaleString()}
        </time>
      </li>
    ))}
  </ul>
);
