import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { LoaderCircle } from 'lucide-react';
import type { OutcomeActionsProps } from '@/components/CardDetails/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { stateLabels } from '@/lib/labels.ts';
import type { CardState } from '@pitchcrew/core';
import { transitions } from '@pitchcrew/core/states';

export const OutcomeActions = ({ card, working, run, act }: OutcomeActionsProps) => {
  const { pending } = useJobWork(card);
  return (
    <div className="tracking-actions">
      {transitions[card.state]
        .filter(
          (state) =>
            ![
              'drafting',
              'in_review',
              'agreed',
              'awaiting_approval',
              'submitted',
              'shortlisted',
            ].includes(state),
        )
        .map((state) => (
          <Button
            key={state}
            aria-busy={pending?.targetState === state}
            disabled={working || Boolean(run)}
            className="button small"
            onClick={() =>
              act(
                `/cards/${card.id}/move`,
                { state },
                `Moved to ${stateLabels[state as CardState]}`,
              )
            }
          >
            {pending?.targetState === state ? (
              <LoaderCircle
                size={14}
                className="spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {pending?.targetState === state ? 'Moving…' : stateLabels[state]}
          </Button>
        ))}
    </div>
  );
};
