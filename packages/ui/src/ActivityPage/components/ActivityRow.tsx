import type { BoardEvent, Snapshot } from '@pitchcrew/core';
import { timeAgo } from '@/lib/time.ts';
import { activityContext, currentStatus, eventTone } from '../history.ts';
import { ActivityRowBody } from './ActivityRowBody.tsx';

/** One event: state bead, the factual sentence, who and where, and its time on the right. */
export const ActivityRow = ({
  event,
  data,
  today,
}: {
  event: BoardEvent;
  data: Snapshot;
  today: boolean;
}) => {
  const tone = eventTone(event, currentStatus(event, data));
  const context = activityContext(event, data);
  return (
    <li className="activity-row" data-kind={event.kind}>
      <span
        className="clay-bead"
        data-size="sm"
        data-tone={tone}
        data-empty={tone ? undefined : ''}
        aria-hidden="true"
      />
      <ActivityRowBody event={event} data={data} context={context} />
      <time dateTime={event.createdAt} title={new Date(event.createdAt).toLocaleString()}>
        {today
          ? timeAgo(event.createdAt)
          : new Date(event.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
      </time>
    </li>
  );
};
