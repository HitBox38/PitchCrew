import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import type { QueueRecoveryPlan } from '../queue-recovery-plan.ts';

/** Router links retain unsaved-editor guards and never issue recovery commands. */
export const QueueRecoveryLink = ({ plan }: { plan: QueueRecoveryPlan }) => (
  <Button
    variant="outline"
    size="sm"
    className="chat-queue-resume"
    nativeButton={false}
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Shared Button renders the actual router anchor below.
    role="link"
    title={plan.title}
    aria-label={`${plan.label}: ${plan.title}`}
    render={
      plan.kind === 'chat' ? (
        <Link to="/chat/$thread" params={{ thread: plan.thread }} />
      ) : (
        <Link to="/queue" />
      )
    }
  >
    {plan.label}
  </Button>
);
