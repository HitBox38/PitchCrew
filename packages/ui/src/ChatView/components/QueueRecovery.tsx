import { useState } from 'react';
import type { Action } from '@/WorkspaceStore/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { runQueueRecovery } from '../queue-focus.ts';
import type { QueueRecoveryPlan } from '../queue-recovery-plan.ts';
import { QueueRecoveryLink } from './QueueRecoveryLink.tsx';

/** User pauses resume normally; failed queues recover one explicit request at a time. */
export const QueueRecovery = ({
  plan,
  action,
  working,
  onReview,
}: {
  plan: QueueRecoveryPlan | null;
  action: Action;
  working: boolean;
  onReview: () => void;
}) => {
  const [pending, setPending] = useState(false);
  if (!plan) return null;
  if (plan.kind === 'chat' || plan.kind === 'queue') return <QueueRecoveryLink plan={plan} />;
  const resume = async (control: HTMLButtonElement) => {
    setPending(true);
    try {
      await runQueueRecovery(control, async () => {
        try {
          return await action(plan.path, 'PUT', { action: 'resume' });
        } finally {
          setPending(false);
        }
      });
    } catch {
      // The shared action reports errors; reveal the saved request and its diagnostics too.
      onReview();
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      variant="outline"
      size="sm"
      className="chat-queue-resume"
      disabled={working || pending}
      title={plan.title}
      onClick={(event) => void resume(event.currentTarget)}
    >
      {plan.label}
    </Button>
  );
};
