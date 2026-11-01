import { TranscriptMessage } from './TranscriptMessage.tsx';
import { JobEventChips } from './JobEventChips.tsx';
import { ChatTurn } from '@/ChatTurn/index.tsx';
import type { TranscriptItem } from '@/ChatTurn/helpers.ts';
import type { ChatMessage } from '@pitchcrew/core';
import { messageDay } from '@/ChatView/helpers.ts';
import type { MessageTranscriptProps } from '@/ChatView/types.ts';
import { useTranscriptJobEvents } from '../hooks/useTranscriptJobEvents.ts';
import { AnimatePresence } from 'motion/react';
import { MessageScrollerItem } from '@pitchcrew/design-system/message-scroller';

/** A reply directly under its own turn; both hang on one thread. */
const repliesTo = (previous: TranscriptItem | undefined, message: ChatMessage) =>
  previous?.kind === 'turn' &&
  previous.run.id === message.runId &&
  previous.run.roleId === message.from;

const continues = (items: TranscriptItem[], index: number) => {
  const item = items[index];
  return item?.kind === 'message' && repliesTo(items[index - 1], item.message);
};

export const MessageTranscript = ({
  items,
  edges = { oldest: true, newest: true },
  ...props
}: MessageTranscriptProps & {
  items: TranscriptItem[];
  /** Whether this page starts or ends the conversation, so job events show once. */
  edges?: { oldest: boolean; newest: boolean };
}) => {
  const replyingRuns = new Set(props.data.streamingMessages.map((message) => message.runId));
  const jobEvents = useTranscriptJobEvents(props.data, props.thread, items, edges, (index) =>
    continues(items, index),
  );
  return (
    <AnimatePresence initial={false}>
      {items.map((item, index) => (
        <MessageScrollerItem
          key={item.id}
          messageId={item.id}
          scrollAnchor={item.kind === 'message' && item.message.from === 'user'}
          className="flex flex-col gap-6"
        >
          {index === 0 ||
          new Date(items[index - 1].createdAt).toDateString() !==
            new Date(item.createdAt).toDateString() ? (
            <div className="chat-day">
              <span>{messageDay(item.createdAt)}</span>
            </div>
          ) : null}
          {jobEvents.get(item.id)?.before ? (
            <JobEventChips events={jobEvents.get(item.id)!.before!} name={props.name} />
          ) : null}
          {item.kind === 'turn' ? (
            <ChatTurn
              run={item.run}
              name={props.name(item.run.roleId)}
              replying={replyingRuns.has(item.run.id)}
            />
          ) : (
            <TranscriptMessage
              {...props}
              message={item.message}
              continued={continues(items, index)}
            />
          )}
          {jobEvents.get(item.id)?.after ? (
            <JobEventChips events={jobEvents.get(item.id)!.after!} name={props.name} />
          ) : null}
        </MessageScrollerItem>
      ))}
    </AnimatePresence>
  );
};
