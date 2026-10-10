import type { ChatViewModel } from '../types.ts';
import { QueuedMessage } from './QueuedMessage.tsx';
export function ConversationQueue({ queued, data, action, working }: ChatViewModel) {
  if (!queued.length) return null;
  return (
    <section className="chat-queue" aria-label="Queued messages">
      <details open>
        <summary>
          Pending work <span>{queued.length}</span>
        </summary>
        {queued.map((request) => (
          <QueuedMessage
            key={request.id}
            request={request}
            data={data}
            action={action}
            working={working}
          />
        ))}
      </details>
    </section>
  );
}
