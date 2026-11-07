import { Link } from '@tanstack/react-router';
import type { Conversation, WorkQueueView } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import type { QueueRecoveryPlan } from '../queue-recovery-plan.ts';
import { QueueRecovery } from './QueueRecovery.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { requestStatus } from '@/ClayInterface/helpers.ts';
import { queueStateLabel } from '../queue-presentation.ts';
import { queueExplanation } from '../queue-recovery.ts';

/** A new attached chat can share a held job lane without owning any of its waiting messages. */
export const SharedQueueContext = ({
  queue,
  plan,
  conversations = [],
  action,
  working,
}: {
  queue: WorkQueueView;
  plan: QueueRecoveryPlan;
  conversations?: readonly Pick<Conversation, 'id' | 'title'>[];
  action: Action;
  working: boolean;
}) => {
  const head = conversations.find(
    (conversation) => conversation.id === queue.requests[0]?.threadId,
  );
  const failed =
    queue.pauseKind === 'failed' ||
    queue.tasks.some((task) => task.status === 'failed') ||
    queue.requests.some((request) =>
      request.deliveries.some((delivery) => delivery.status === 'failed'),
    );
  return (
    <section
      className="chat-queue"
      data-tone={failed ? 'rose' : 'ochre'}
      aria-label="Shared job queue"
    >
      <div className="chat-queue-heading">
        <p className="chat-queue-state min-w-0 flex-1">
          <StatusBead
            status={
              failed
                ? 'failed'
                : requestStatus(
                    queue.requests.flatMap((request) =>
                      request.deliveries.map((delivery) => delivery.status),
                    ),
                  )
            }
          />{' '}
          <strong>Job queue</strong> · {queueStateLabel(queue, queue.requests)}
        </p>
        <QueueRecovery plan={plan} action={action} working={working} onReview={() => {}} />
      </div>
      <p className="chat-queue-explanation">
        {plan.kind === 'chat' || plan.kind === 'queue' ? (
          plan.explanation
        ) : (
          <>
            Earlier queued work for this job is{' '}
            {head ? (
              <>
                in{' '}
                <Link to="/chat/$thread" params={{ thread: head.id }}>
                  {head.title}
                </Link>
                .
              </>
            ) : (
              'in another conversation.'
            )}{' '}
            {queueExplanation(queue)}
          </>
        )}
      </p>
    </section>
  );
};
