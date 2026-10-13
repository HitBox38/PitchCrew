import type { ChatViewModel } from '../types.ts';
import { QueuedMessage } from './QueuedMessage.tsx';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ChevronDown, Clock3, CircleAlert } from 'lucide-react';

export function ConversationQueue({ queued, data, action, working, thread }: ChatViewModel) {
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
      <Collapsible key={thread}>
        <CollapsibleTrigger render={<Button variant="ghost" className="chat-queue-trigger" />}>
          <Icon size={13} aria-hidden="true" />
          <span>{label}</span>
          <ChevronDown size={13} className="chat-queue-chevron" aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
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
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
