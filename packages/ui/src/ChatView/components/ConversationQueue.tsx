import type { ChatViewModel } from '../types.ts';
import { Queue, QueueSection, QueueSectionContent } from '@/components/ai-elements/queue/index.tsx';
import { QueueHeading } from './QueueHeading.tsx';
import {
  conversationQueue,
  initialQueueAttention,
  queueAttentionKeys,
  queueCountLabel,
  queueStateLabel,
} from '../queue-presentation.ts';
import { useQueueDisclosure } from '../hooks/useQueueDisclosure.ts';
import { QueuedMessageList } from './QueuedMessageList.tsx';
import { QueuedEditorSession } from './QueuedEditorSession.tsx';
import { queueExplanation } from '../queue-recovery.ts';
import { queueRecoveryPlan } from '../queue-recovery-plan.ts';
import { SharedQueueContext } from './SharedQueueContext.tsx';
import { useQueuedEditorSelection } from '../hooks/useQueuedEditorSelection.ts';

export const ConversationQueue = ({
  queued,
  data,
  action,
  working,
  thread,
}: Pick<ChatViewModel, 'queued' | 'data' | 'action' | 'working' | 'thread'>) => {
  const has = (status: string) =>
    queued.some((request) => request.deliveries.some((delivery) => delivery.status === status));
  // Rose only when something failed; paused work waits on a person, so it is ochre.
  const tone = has('failed') ? 'rose' : has('paused') ? 'ochre' : undefined;
  const queue = conversationQueue(data.queue, thread, data.conversations);
  const { open, setOpen } = useQueueDisclosure(
    thread,
    queueAttentionKeys(queued),
    initialQueueAttention(queue, queued),
  );
  const { selection, selected, edit } = useQueuedEditorSelection(thread, data.chatRequests);
  const count = queueCountLabel(queued, queue);
  const state = queueStateLabel(
    queue,
    queued,
    data.userInputs?.some(
      (question) => question.threadId === thread && question.status === 'pending',
    ),
  );
  const plan = queueRecoveryPlan(queue, queued, thread, data.conversations);
  const explanation =
    plan?.kind === 'chat' || plan?.kind === 'queue' ? plan.explanation : queueExplanation(queue);
  return (
    <>
      {!queued.length && queue && plan ? (
        <SharedQueueContext
          queue={queue}
          plan={plan}
          conversations={data.conversations}
          action={action}
          working={working}
        />
      ) : null}
      {queued.length ? (
        <section className="chat-queue" data-tone={tone} aria-label="Queued messages">
          <Queue>
            <QueueSection key={thread} open={open} onOpenChange={setOpen}>
              <QueueHeading
                count={count}
                state={state}
                queued={queued}
                plan={plan}
                action={action}
                working={working}
                onReview={() => setOpen(true)}
              />
              <QueueSectionContent keepMounted>
                {explanation ? <p className="chat-queue-explanation">{explanation}</p> : null}
                <QueuedMessageList
                  queued={queued}
                  data={data}
                  action={action}
                  working={working}
                  onEdit={edit}
                />
              </QueueSectionContent>
            </QueueSection>
          </Queue>
        </section>
      ) : null}
      {selection && selected ? (
        <QueuedEditorSession
          key={`${selected.id}-${selection.session}`}
          request={selected}
          action={action}
          working={working}
          started={data.runs.some((run) => run.requestId === selected.id)}
        />
      ) : null}
    </>
  );
};
