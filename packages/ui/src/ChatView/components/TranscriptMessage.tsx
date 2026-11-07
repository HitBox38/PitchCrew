import { TranscriptMessageContent } from './TranscriptMessageContent.tsx';
import { MemoryUsed } from './MemoryUsed.tsx';
import { AnimatedMessage } from '@/ChatView/constants.ts';
import type { MessageTranscriptProps } from '@/ChatView/types.ts';
import type { ChatMessage } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { ArrowRight, BriefcaseBusiness, LoaderCircle } from 'lucide-react';
import { ReplyActions } from './ReplyActions.tsx';
import { MessageTimestamp } from './MessageTimestamp.tsx';

export const TranscriptMessage = ({
  message,
  data,
  streamingIds,
  reduced,
  name,
  thread,
  onOpenCard,
  answerQuestion,
  continued,
  timestamp,
}: Omit<MessageTranscriptProps, 'messages'> & {
  message: ChatMessage;
  continued?: boolean;
  timestamp?: string;
}) => {
  const job = data.cards.find((card) => card.id === message.cardId);
  const sameJob = data.conversations?.some((item) => item.id === thread && item.cardId === job?.id);
  const streaming = streamingIds.has(message.id);
  const request =
    message.from === 'user'
      ? data.chatRequests?.find((item) => item.messageId === message.id)
      : undefined;
  const cancelledUnsent =
    request?.deliveries.length &&
    request.deliveries.every((delivery) => !delivery.runId && delivery.status === 'cancelled');
  return (
    <AnimatedMessage
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      from={message.from === 'user' ? 'user' : 'assistant'}
      className={`chat-message ${message.from === 'system' ? 'chat-system' : ''}`}
      data-continued={continued ? '' : undefined}
    >
      <div
        className={`chat-message-meta flex items-center gap-2 text-detail text-muted-foreground${continued ? ' sr-only' : ''}`}
      >
        {message.from !== 'user' && message.from !== 'system' ? (
          <RoleAvatar agentRole={message.from} size="small" />
        ) : null}
        <strong>{name(message.from)}</strong>
        {thread === 'crew' && message.to !== 'crew' ? (
          <span className="chat-route inline-flex items-center gap-1.25 text-detail text-muted-foreground">
            <ArrowRight size={12} /> {name(message.to)}
          </span>
        ) : null}
        {message.from === 'user' || message.from === 'system' ? (
          <MessageTimestamp createdAt={message.createdAt} timestamp={timestamp} />
        ) : null}
      </div>
      <TranscriptMessageContent
        message={message}
        data={data}
        streaming={streaming}
        answerQuestion={answerQuestion}
      />
      <MemoryUsed message={message} data={data} />
      {cancelledUnsent ? <span className="chat-message-delivery">Not sent · cancelled</span> : null}
      {message.from !== 'user' && message.from !== 'system' && !message.userInput && !streaming ? (
        <ReplyActions message={message} />
      ) : null}
      {streaming ? (
        <span className="chat-stream-status ml-7.5 flex items-center gap-1.5 text-detail text-muted-foreground">
          <LoaderCircle size={12} className="spin" /> Replying…
        </span>
      ) : null}
      {job ? (
        <Button
          variant="ghost"
          className="chat-job-link"
          data-same-job={sameJob ? '' : undefined}
          onClick={() => onOpenCard(job.id)}
        >
          <BriefcaseBusiness size={12} /> {job.company} · {job.title}
        </Button>
      ) : null}
    </AnimatedMessage>
  );
};
