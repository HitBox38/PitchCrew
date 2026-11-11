import type { ChatRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
import { TraceCollapsibleTrigger } from '@pitchcrew/design-system/trace';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { requestStatus } from '@/ClayInterface/helpers.ts';
import { QueueRecovery } from './QueueRecovery.tsx';
import type { QueueRecoveryPlan } from '../queue-recovery-plan.ts';

export const QueueHeading = ({
  count,
  state,
  queued,
  ...recovery
}: {
  count: string;
  state: string;
  queued: ChatRequest[];
  plan: QueueRecoveryPlan | null;
  action: Action;
  working: boolean;
  onReview: () => void;
}) => (
  <div className="chat-queue-heading">
    <TraceCollapsibleTrigger className="chat-queue-trigger" aria-label={`${count} · ${state}`}>
      <StatusBead
        status={requestStatus(
          queued.flatMap((request) => request.deliveries.map((item) => item.status)),
        )}
      />
      <strong className="chat-queue-count">{count}</strong>
      <span className="chat-queue-state">{state}</span>
    </TraceCollapsibleTrigger>
    <QueueRecovery {...recovery} />
  </div>
);
