import type { BoardEvent, Snapshot } from '@pitchcrew/core';
import { ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible/index.tsx';
import { actorLabels, eventKindLabels } from '../constants.ts';
import type { ActivityContext } from '../history.ts';
import { activityDetail, activitySentence } from '../labels.ts';
import { ActivityContextLink } from './ActivityContextLink.tsx';

/** The event's product sentence, who and where, and any stored specifics behind Details. */
export const ActivityRowBody = ({
  event,
  data,
  context,
}: {
  event: BoardEvent;
  data: Snapshot;
  context: ActivityContext | null;
}) => {
  const nameOf = (id: string) => data.roles.find((role) => role.id === id)?.name;
  const titleOf = (id: string) => data.conversations?.find((item) => item.id === id)?.title;
  const actor = actorLabels[event.actor] ?? nameOf(event.actor) ?? event.actor;
  const detail = activityDetail(event);
  return (
    <Collapsible className="activity-row-body">
      <p className="activity-message">{activitySentence(event, nameOf, titleOf)}</p>
      <div className="activity-meta">
        <span>{actor}</span>
        <span className="sr-only">, {eventKindLabels[event.kind]}</span>
        {context ? <ActivityContextLink context={context} /> : null}
        {detail ? (
          <CollapsibleTrigger className="activity-detail-trigger">
            <ChevronRight size={12} aria-hidden="true" />
            Details
          </CollapsibleTrigger>
        ) : null}
      </div>
      {detail ? (
        <CollapsibleContent className="activity-detail">{detail}</CollapsibleContent>
      ) : null}
    </Collapsible>
  );
};
