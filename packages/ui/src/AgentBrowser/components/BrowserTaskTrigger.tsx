import { Button } from '@pitchcrew/design-system/button';
import { PopoverTrigger } from '@pitchcrew/design-system/popover';
import { browserStateBead, type browserState } from '../layout.ts';

/**
 * The header's one state chip: who has the page right now, as a bead and a short label. It opens
 * task details (mode, task and site access); its tooltip carries the privacy note.
 */
export const BrowserTaskTrigger = ({
  state,
  nudged,
}: {
  state: ReturnType<typeof browserState>;
  /** The user pressed the page while the agent works: flash ochre toward Take control. */
  nudged: boolean;
}) => {
  const bead = browserStateBead[state.tone];
  return (
    <PopoverTrigger
      render={
        <Button
          size="sm"
          variant="ghost"
          className="browser-state-chip"
          data-tone={state.tone}
          data-nudged={nudged || undefined}
          aria-label={`Browser status: ${state.label}. Task details`}
          title={state.detail}
        />
      }
    >
      {state.tone === 'opening' ? (
        <span className="clay-job-spinner" aria-hidden="true" />
      ) : (
        <span
          className="clay-bead"
          data-size="sm"
          data-tone={nudged ? 'ochre' : (bead ?? undefined)}
          data-empty={nudged || bead ? undefined : ''}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{state.label}</span>
    </PopoverTrigger>
  );
};
