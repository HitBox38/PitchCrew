import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { JobNextAction } from '../next-action.ts';

/**
 * Recorded outcomes are equal choices, so none is glazed. Wide docks show them as clay buttons;
 * phones fold them into one menu so the dock keeps its height.
 */
export const OutcomeChoices = ({
  label,
  choices,
  disabled,
}: {
  label: string;
  choices: JobNextAction[];
  disabled: boolean;
}) => (
  <>
    <fieldset className="job-dock-choices" aria-label={label}>
      {choices.map((choice) => (
        <Button
          key={choice.label}
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={choice.perform}
        >
          {choice.label}
        </Button>
      ))}
    </fieldset>
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="job-dock-menu" />}
        disabled={disabled}
      >
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-48" aria-label={label}>
        {choices.map((choice) => (
          <DropdownMenuItem key={choice.label} className="min-h-11" onClick={choice.perform}>
            {choice.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </>
);
