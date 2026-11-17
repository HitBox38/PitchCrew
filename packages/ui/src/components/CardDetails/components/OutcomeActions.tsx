import { useJobWork } from '@/components/JobWorkStatus/hooks/useJobWork.ts';
import { LoaderCircle } from 'lucide-react';
import type { OutcomeActionsProps } from '@/components/CardDetails/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { stateLabels, statusActionLabels } from '@/lib/labels.ts';
import type { CardState } from '@pitchcrew/core';
import { outcomeTargets } from '../helpers.ts';

/** A quiet "Change…" menu for a manual status change, beside the job's current status. */
export const OutcomeActions = ({ card, working, run, act }: OutcomeActionsProps) => {
  const { pending } = useJobWork(card);
  const targets = outcomeTargets(card.state);
  if (!targets.length) return null;
  const moving = pending?.targetState;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" aria-busy={Boolean(moving)} />}
        disabled={working || Boolean(run) || Boolean(moving)}
      >
        {moving ? (
          <LoaderCircle size={14} className="spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {moving ? 'Moving…' : 'Change…'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-64 min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            Records what happened. Never contacts the employer.
          </DropdownMenuLabel>
          {targets.map((state) => (
            <DropdownMenuItem
              key={state}
              className="min-h-9 pointer-coarse:min-h-11"
              onClick={() =>
                act(
                  `/cards/${card.id}/move`,
                  { state },
                  `Moved to ${stateLabels[state as CardState]}`,
                )
              }
            >
              {statusActionLabels[state] ?? `Mark ${stateLabels[state].toLowerCase()}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
