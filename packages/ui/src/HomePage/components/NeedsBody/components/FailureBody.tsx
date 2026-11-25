import type { ChatRequest, WorkQueueView } from '@pitchcrew/core';
import { boardActionLabels } from '@pitchcrew/core/states';
import { Button } from '@pitchcrew/design-system/button';
import { useQueueActions } from '@/hooks/useQueueActions.ts';
import { QueueFollowUps } from '@/QueuePage/components/QueueFollowUps.tsx';
import { QueueRequestRecovery } from '@/QueuePage/components/QueueRequestRecovery.tsx';
import { useQueueRequest } from '@/QueuePage/hooks/useQueueRequest.ts';
import { stoppedDelivery } from '@/lib/attention.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import { deskScope } from '../../../constants.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { OpenHeader } from './OpenHeader.tsx';
import { WaitingOn } from './WaitingOn.tsx';

type RecoveryProps = { request: ChatRequest; queueId: string; action: Action; armedAt: number };

/** Retry (the row's glazed verb) or Skip and continue, for the request the queue stopped on. */
const RequestRecovery = ({ request, queueId, action, armedAt }: RecoveryProps) => {
  const model = useQueueRequest(request, queueId, {}, action);
  return <QueueRequestRecovery model={model} shortcut={deskScope} armedAt={armedAt} />;
};

/**
 * Nothing stopped is left (it was skipped or removed, and the queue's resume never went through),
 * yet the queue stays paused: what changed since the pause, then its own Resume, the command Queue
 * sends, which the daemon accepts once no stopped request or failed follow-up remains.
 */
const QueueResume = ({ queue, action }: { queue: WorkQueueView; action: Action }) => {
  const { command, working } = useQueueActions(queue, undefined, action);
  return (
    <>
      <p className="needs-note">
        The stopped work is gone. Resume the queue to start what waits in it.
      </p>
      <div className="queue-request-recovery">
        <Button size="sm" disabled={working} onClick={() => command('resume')}>
          Resume queue
        </Button>
      </div>
    </>
  );
};

/**
 * A stopped request: what stopped and why, then its recovery. A failed crew follow-up in the same
 * job queue comes first, because until it is retried or skipped the server refuses both the
 * request's Retry and the queue's resume; so while one waits, the request shows no Retry of its
 * own, only what follows.
 */
export const FailureBody = ({ item, data, armedAt }: BodyProps) => {
  const { act } = useDeskTools();
  const queue = data.queue?.queues.find((entry) => entry.id === item.queueId);
  if (!queue) return null;
  const action = act({ item, data });
  const stopped = stoppedDelivery(queue);
  const followUps = queue.tasks.filter((task) => task.status === 'failed');
  const head = stopped?.request.boardAction;
  return (
    <>
      <OpenHeader item={item} data={data} />
      <WaitingOn item={item} data={data} />
      <QueueFollowUps tasks={followUps} queueId={queue.id} data={data} action={action} />
      {stopped && followUps.length ? (
        <p className="needs-note">
          {head ? boardActionLabels[head] : 'The stopped request'} waits until the follow-up is
          retried or skipped.
        </p>
      ) : stopped ? (
        <RequestRecovery
          request={stopped.request}
          queueId={queue.id}
          action={action}
          armedAt={armedAt}
        />
      ) : followUps.length ? null : (
        <QueueResume queue={queue} action={action} />
      )}
    </>
  );
};
