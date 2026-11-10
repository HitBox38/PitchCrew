import { TranscriptEntry } from './TranscriptEntry.tsx';
import type { TranscriptItem } from '@/ChatTurn/helpers.ts';
import type { ChatMessage } from '@pitchcrew/core';
import type { MessageTranscriptProps } from '@/ChatView/types.ts';
import { useTranscriptJobEvents } from '../hooks/useTranscriptJobEvents.ts';
import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useOpenQuestionId } from '@/UserQuestions/QuestionDockProvider.tsx';
import { usePendingSend } from '../hooks/usePendingSend.ts';
import { usePinSent } from '../hooks/usePinSent.ts';
import { useStableHandlers } from '../hooks/useStableHandlers.ts';
import { transcriptKey } from '../send-flight.ts';

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
  items: sourceItems,
  edges = { oldest: true, newest: true },
  ...props
}: MessageTranscriptProps & {
  items: TranscriptItem[];
  /** Whether this page starts or ends the conversation, so job events show once. */
  edges?: { oldest: boolean; newest: boolean };
}) => {
  // The scroller pins any user message it has not pinned yet whenever the entry count holds steady
  // (the window drops the oldest as the newest arrives), so only messages sent since this page
  // opened are anchors; otherwise a send jumps the page to its first user message.
  const [opened] = useState(() => new Set(sourceItems.map((item) => transcriptKey(item.id))));
  const openQuestionId = useOpenQuestionId();
  const shownItems = sourceItems.filter(
    (item) =>
      item.kind !== 'message' ||
      item.message.userInput?.kind !== 'question' ||
      item.message.userInput.id !== openQuestionId,
  );
  const items = usePendingSend(props.thread, shownItems, props.data.chatRequests, edges.newest);
  usePinSent(items, opened);
  const replyingRuns = new Set(props.data.streamingMessages.map((message) => message.runId));
  const jobEvents = useTranscriptJobEvents(props.data, props.thread, items, edges, (index) =>
    continues(items, index),
  );
  const handlers = useStableHandlers(props.onOpenCard, props.answerQuestion);
  return (
    <AnimatePresence initial={false}>
      {items.map((item, index) => (
        <TranscriptEntry
          key={transcriptKey(item.id)}
          {...props}
          {...handlers}
          item={item}
          anchor={
            item.kind === 'message' &&
            item.message.from === 'user' &&
            !opened.has(transcriptKey(item.id))
          }
          day={
            index === 0 ||
            new Date(items[index - 1].createdAt).toDateString() !==
              new Date(item.createdAt).toDateString()
          }
          events={jobEvents.get(item.id)}
          continued={continues(items, index)}
          replying={item.kind === 'turn' && replyingRuns.has(item.run.id)}
        />
      ))}
    </AnimatePresence>
  );
};
