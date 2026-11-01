import { ChevronDown } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { creationSteps } from '../constants.ts';
import type { CreationController } from '../types.ts';

/**
 * A labelled bead track: completed steps can be revisited, future ones open only through
 * Continue so validation is never skipped. Phones get "Step 3 of 6: Tools" and a step menu.
 */
export const CreationSteps = ({
  step,
  saving,
  working,
  goTo,
}: Pick<CreationController, 'step' | 'saving' | 'working' | 'goTo'>) => {
  const state = (index: number) => (index < step ? 'done' : index === step ? 'current' : 'next');
  return (
    <nav className="agent-wizard-steps" aria-label="Agent setup steps">
      <ol className="agent-wizard-track">
        {creationSteps.map((label, index) => (
          <li key={label} data-state={state(index)}>
            <Button
              variant="ghost"
              disabled={saving || working || index > step}
              aria-current={index === step ? 'step' : undefined}
              onClick={() => goTo(index)}
            >
              <span className="clay-bead" data-size="lg" aria-hidden="true" />
              <span>{label}</span>
              {index < step ? <span className="sr-only"> (done)</span> : null}
            </Button>
          </li>
        ))}
      </ol>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" className="agent-wizard-step-menu" disabled={saving} />}
        >
          Step {step + 1} of {creationSteps.length}: {creationSteps[step]}
          <ChevronDown size={14} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {creationSteps.map((label, index) => (
              <DropdownMenuItem
                key={label}
                disabled={working || index > step}
                onClick={() => goTo(index)}
              >
                {index + 1}. {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};
