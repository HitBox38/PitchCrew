import type { ChatViewModel } from '../types.ts';
import { QueuedMessage } from './QueuedMessage.tsx';
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionContent,
} from '@/components/ai-elements/queue/index.tsx';
import { TraceLine } from '@/components/ui/trace/components/TraceLine.tsx';
import { TraceTitle } from '@/components/ui/trace/components/TraceTitle.tsx';
import { TraceIcon } from '@/components/ui/trace/components/TraceIcon.tsx';
import { Clock3, CircleAlert } from 'lucide-react';

export function ConversationQueue({
  queued,
  data,
  action,
  working,
  thread,
}: Pick<ChatViewModel, 'queued' | 'data' | 'action' | 'working' | 'thread'>) {
  if (!queued.length) return null;
  const attention = queued.filter((request) =>
    request.deliveries.some(
      (delivery) => delivery.status === 'paused' || delivery.status === 'failed',
    ),
  ).length;
  const label = attention
    ? queued.length === 1
      ? '1 message needs attention'
      : `${queued.length} messages · ${attention} ${attention === 1 ? 'needs' : 'need'} attention`
    : `${queued.length} queued ${queued.length === 1 ? 'message' : 'messages'}`;
  const Icon = attention ? CircleAlert : Clock3;
  return (
    <section className="chat-queue" aria-label="Queued messages">
      <Queue>
        <QueueSection key={thread}>
          <QueueSectionTrigger className="chat-queue-trigger">
            <TraceLine className="flex-1" status={attention ? 'error' : 'pending'}>
              <TraceIcon>
                <Icon size={13} />
              </TraceIcon>
              <TraceTitle>{label}</TraceTitle>
            </TraceLine>
          </QueueSectionTrigger>
          <QueueSectionContent>
            <div className="chat-queue-content">
              {queued.map((request) => (
                <QueuedMessage
                  key={request.id}
                  request={request}
                  data={data}
                  action={action}
                  working={working}
                />
              ))}
            </div>
          </QueueSectionContent>
        </QueueSection>
      </Queue>
    </section>
  );
}
