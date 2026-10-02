import { AnimatedMessage } from '@/ChatView/constants.ts';
import { messageDay } from '@/ChatView/helpers.ts';
import type { MessageTranscriptProps } from '@/ChatView/types.ts';
import { MessageContent } from '@/components/ai-elements/message/components/MessageContent.tsx';
import { MessageResponse } from '@/components/ai-elements/message/components/MessageResponse.tsx';
import { noRemoteImages } from '@/components/ai-elements/message/constants.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { timeAgo } from '@/lib/time.ts';
import { ArrowRight, BriefcaseBusiness, LoaderCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { Fragment } from 'react';

export function MessageTranscript({
  messages,
  data,
  streamingIds,
  reduced,
  name,
  thread,
  onOpenCard,
}: MessageTranscriptProps) {
  return (
    <AnimatePresence initial={false}>
      {messages.map((message, index) => {
        const job = data.cards.find((c) => c.id === message.cardId);
        const streaming = streamingIds.has(message.id);
        return (
          <Fragment key={message.id}>
            {index === 0 ||
            new Date(messages[index - 1].createdAt).toDateString() !==
              new Date(message.createdAt).toDateString() ? (
              <div className="chat-day">
                <span>{messageDay(message.createdAt)}</span>
              </div>
            ) : null}
            <AnimatedMessage
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              from={message.from === 'user' ? 'user' : 'assistant'}
              className={`chat-message ${message.from === 'system' ? 'chat-system' : ''}`}
            >
              <div className="chat-message-meta">
                {message.from !== 'user' && message.from !== 'system' ? (
                  <RoleAvatar agentRole={message.from} size="small" />
                ) : null}
                <strong>{name(message.from)}</strong>
                {thread === 'crew' && message.to !== 'crew' ? (
                  <span className="chat-route">
                    <ArrowRight size={12} /> {name(message.to)}
                  </span>
                ) : null}
                <time
                  dateTime={message.createdAt}
                  title={new Date(message.createdAt).toLocaleString()}
                >
                  {timeAgo(message.createdAt)}
                </time>
              </div>
              <MessageContent className="chat-message-content" aria-busy={streaming}>
                <MessageResponse
                  mode={streaming ? 'streaming' : 'static'}
                  isAnimating={streaming}
                  components={noRemoteImages}
                >
                  {message.content}
                </MessageResponse>
              </MessageContent>
              {streaming ? (
                <span className="chat-stream-status">
                  <LoaderCircle size={12} className="spin" /> Replying…
                </span>
              ) : null}
              {job ? (
                <Button
                  variant="ghost"
                  className="chat-job-link"
                  onClick={() => onOpenCard(job.id)}
                >
                  <BriefcaseBusiness size={12} /> {job.company} · {job.title}
                </Button>
              ) : null}
            </AnimatedMessage>
          </Fragment>
        );
      })}
    </AnimatePresence>
  );
}
