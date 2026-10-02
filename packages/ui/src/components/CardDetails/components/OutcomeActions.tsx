import type { OutcomeActionsProps } from '@/components/CardDetails/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { stateLabels } from '@/lib/labels.ts';
import type { CardState } from '@pitchcrew/core';
import { transitions } from '@pitchcrew/core/states';

export function OutcomeActions({ card, working, run, act }: OutcomeActionsProps) {
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
            {stateLabels[state]}
          </Button>
        ))}
    </div>
  );
}
