import { TranscriptMessage } from './TranscriptMessage.tsx';
import { ChatTurn } from '@/ChatTurn/index.tsx';
import type { TranscriptItem } from '@/ChatTurn/helpers.ts';
import { messageDay } from '@/ChatView/helpers.ts';
import type { MessageTranscriptProps } from '@/ChatView/types.ts';
import { AnimatePresence } from 'motion/react';
import { MessageScrollerItem } from '@/components/ui/message-scroller/components/MessageScrollerItem.tsx';

export function MessageTranscript({
  items,
  ...props
}: MessageTranscriptProps & { items: TranscriptItem[] }) {
  const replyingRuns = new Set(props.data.streamingMessages.map((message) => message.runId));
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
          {item.kind === 'turn' ? (
            <ChatTurn
              run={item.run}
              name={props.name(item.run.roleId)}
              replying={replyingRuns.has(item.run.id)}
            />
          ) : (
            <TranscriptMessage {...props} message={item.message} />
          )}
        </MessageScrollerItem>
      ))}
    </AnimatePresence>
  );
}
