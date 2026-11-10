import { memo } from 'react';
import { MessageScrollerItem } from '@pitchcrew/design-system/message-scroller';
import { ChatTurn } from '@/ChatTurn/index.tsx';
import { messageDay } from '@/ChatView/helpers.ts';
import { sameEntry, type TranscriptEntryProps } from '../transcript-entry.ts';
import { JobEventChips } from './JobEventChips.tsx';
import { TranscriptMessage } from './TranscriptMessage.tsx';

/** One transcript entry, rendered again only when something it shows changed (see sameEntry). */
export const TranscriptEntry = memo(
  ({ item, anchor, day, events, continued, replying, ...props }: TranscriptEntryProps) => (
    <MessageScrollerItem messageId={item.id} scrollAnchor={anchor} className="flex flex-col gap-6">
      {day ? (
        <div className="chat-day">
          <span>{messageDay(item.createdAt)}</span>
        </div>
      ) : null}
      {events?.before ? <JobEventChips events={events.before} name={props.name} /> : null}
      {item.kind === 'turn' ? (
        <ChatTurn run={item.run} name={props.name(item.run.roleId)} replying={replying} />
      ) : (
        <TranscriptMessage
          {...props}
          message={item.message}
          timestamp={item.createdAt}
          continued={continued}
        />
      )}
      {events?.after ? <JobEventChips events={events.after} name={props.name} /> : null}
    </MessageScrollerItem>
  ),
  sameEntry,
);
