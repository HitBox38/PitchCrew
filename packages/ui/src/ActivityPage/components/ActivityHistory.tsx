import type { BoardEvent } from '@pitchcrew/core';
import { actorLabels, eventKindLabels } from '@/ActivityPage/constants.ts';
import { timeAgo } from '@/lib/time.ts';

export function ActivityHistory({ events }: { events: BoardEvent[] }) {
  return (
    <section
      className="activity-history min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 max-mobile:px-3"
      aria-label="Activity history"
    >
      <ol className="activity-list mx-auto max-w-245">
        {events.map((event) => (
          <li
            className={`activity-row flex min-w-0 items-start gap-3 border-b border-border py-4 last:border-0 ${event.kind}`}
            key={event.id}
          >
            <span className="activity-marker mt-1.75 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="activity-message text-body leading-relaxed wrap-anywhere">
                {event.message}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-detail text-muted-foreground">
                <span className="wrap-anywhere">{actorLabels[event.actor] ?? event.actor}</span>
                <span className="activity-kind">{eventKindLabels[event.kind]}</span>
                <time className="ml-auto" dateTime={event.createdAt} title={event.createdAt}>
                  {timeAgo(event.createdAt)}
                </time>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
