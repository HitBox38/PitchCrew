import type { RunActivity } from '@pitchcrew/core';
import { activityGroups } from '../helpers.ts';
import { ClaySteps } from './ClaySteps.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';

export const ActivityEntries = ({
  entries,
  waiting,
}: {
  entries: RunActivity[];
  /** The ids of steps waiting on the user, found once for the whole turn. */
  waiting?: ReadonlySet<string>;
}) =>
  activityGroups(entries).map((group) =>
    group.kind === 'work' ? (
      <ClaySteps key={group.id} entries={group.entries} waiting={waiting} />
    ) : (
      <div key={group.id} className="chat-turn-commentary">
        <MessageResponse
          mode={group.entries[0].status === 'running' ? 'streaming' : 'static'}
          components={noRemoteImages}
        >
          {group.entries[0].text}
        </MessageResponse>
      </div>
    ),
  );
