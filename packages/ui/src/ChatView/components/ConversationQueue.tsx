import type { ChatViewModel } from '../types.ts';
import { QueuedMessage } from './QueuedMessage.tsx';
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionContent,
} from '@/components/ai-elements/queue/index.tsx';
import { TraceLine, TraceTitle } from '@pitchcrew/design-system/trace';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { requestStatus } from '@/ClayInterface/helpers.ts';

export const ConversationQueue = ({
  queued,
  data,
  action,
  working,
  thread,
}: Pick<ChatViewModel, 'queued' | 'data' | 'action' | 'working' | 'thread'>) => {
  if (!queued.length) return null;
  const has = (status: string) =>
    queued.some((request) => request.deliveries.some((delivery) => delivery.status === status));
  // Rose only when something failed; paused work waits on a person, so it is ochre.
  const tone = has('failed') ? 'rose' : has('paused') ? 'ochre' : undefined;
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
  return (
    <section className="chat-queue" data-tone={tone} aria-label="Queued messages">
      <Queue>
        <QueueSection key={thread}>
          <QueueSectionTrigger className="chat-queue-trigger">
            <TraceLine className="flex-1" status={tone ? undefined : 'pending'}>
              <span className="clay-step-beads" aria-hidden="true">
                {queued.slice(0, 8).map((request) => (
                  <StatusBead
                    key={request.id}
                    status={requestStatus(request.deliveries.map((item) => item.status))}
                  />
                ))}
              </span>
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
};
