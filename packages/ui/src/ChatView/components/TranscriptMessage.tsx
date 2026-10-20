import { TranscriptMessageContent } from './TranscriptMessageContent.tsx';
import { MemoryUsed } from './MemoryUsed.tsx';
import { AnimatedMessage } from '@/ChatView/constants.ts';
import type { MessageTranscriptProps } from '@/ChatView/types.ts';
import type { ChatMessage } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { ArrowRight, BriefcaseBusiness, LoaderCircle } from 'lucide-react';

export const TranscriptMessage = ({
  message,
  data,
  streamingIds,
  reduced,
  name,
  thread,
  onOpenCard,
  answerQuestion,
}: Omit<MessageTranscriptProps, 'messages'> & { message: ChatMessage }) => {
  const job = data.cards.find((card) => card.id === message.cardId);
  const streaming = streamingIds.has(message.id);
  return (
    <AnimatedMessage
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      from={message.from === 'user' ? 'user' : 'assistant'}
      className={`chat-message ${message.from === 'system' ? 'chat-system' : ''}`}
    >
      <div className="chat-message-meta flex items-center gap-2 text-detail text-muted-foreground">
        {message.from !== 'user' && message.from !== 'system' ? (
          <RoleAvatar agentRole={message.from} size="small" />
        ) : null}
        <strong>{name(message.from)}</strong>
        {thread === 'crew' && message.to !== 'crew' ? (
          <span className="chat-route inline-flex items-center gap-1.25 text-detail text-muted-foreground">
            <ArrowRight size={12} /> {name(message.to)}
          </span>
        ) : null}
        <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()}>
          {timeAgo(message.createdAt)}
        </time>
      </div>
      <TranscriptMessageContent
        message={message}
        data={data}
        streaming={streaming}
        answerQuestion={answerQuestion}
      />
      <MemoryUsed message={message} data={data} />
      {streaming ? (
        <span className="chat-stream-status ml-7.5 flex items-center gap-1.5 text-detail text-muted-foreground">
          <LoaderCircle size={12} className="spin" /> Replying…
        </span>
      ) : null}
      {job ? (
        <Button variant="ghost" className="chat-job-link" onClick={() => onOpenCard(job.id)}>
          <BriefcaseBusiness size={12} /> {job.company} · {job.title}
        </Button>
      ) : null}
    </AnimatedMessage>
  );
};
