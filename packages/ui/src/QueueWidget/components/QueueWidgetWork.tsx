import { boardActionLabels } from '@pitchcrew/core/states';
import type { Snapshot, WorkQueueView } from '@pitchcrew/core';
import { useQueueActions } from '@/hooks/useQueueActions.ts';
import {
  executingRuns,
  queueAnswerThread,
  queueIdentity,
  queueStateLabels,
} from '@/lib/work-queue.ts';
import { queueBeadTone } from '../helpers.ts';
import { QueueWidgetAgent } from './QueueWidgetAgent.tsx';

/** One job or conversation: its bead, identity, what it is waiting on, and its running agents. */
export const QueueWidgetWork = ({
  queue,
  data,
  close,
}: {
  queue: WorkQueueView;
  data: Snapshot;
  close: () => void;
}) => {
  const runs = executingRuns(queue.runs);
  const identity = queueIdentity(queue, data);
  const waiting = queue.state === 'waiting';
  const { open } = useQueueActions(queue, waiting ? queueAnswerThread(queue, data) : undefined);
  const request = queue.requests[0];
  const tone = queueBeadTone(queue);
  const detail =
    queue.state === 'ready' && request
      ? request.boardAction
        ? boardActionLabels[request.boardAction]
        : request.content
      : queue.state !== 'running'
        ? queue.reason || queueStateLabels[queue.state]
        : !runs.length
          ? 'Preparing the next step…'
          : '';
  return (
    <li className="queue-widget-work" data-state={queue.state}>
      <button
        type="button"
        className="queue-widget-open"
        aria-label={`Open ${queue.title}`}
        onClick={() => {
          close();
          open();
        }}
      >
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={tone}
          data-empty={tone ? undefined : ''}
          aria-hidden="true"
        />
        <span className="queue-widget-identity">
          <strong title={identity.title}>{identity.title}</strong>
          <span className="queue-widget-subtitle">{identity.subtitle}</span>
        </span>
        <span className="queue-widget-action" aria-hidden="true">
          {waiting ? 'Answer' : 'Open'}
        </span>
      </button>
      {detail ? (
        <p className="queue-widget-preview" data-state={queue.state}>
          {detail}
        </p>
      ) : null}
      {runs.map((run) => (
        <QueueWidgetAgent key={run.id} run={run} queue={queue} data={data} close={close} />
      ))}
    </li>
  );
};
