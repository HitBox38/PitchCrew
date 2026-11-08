import { Button } from '@pitchcrew/design-system/button';
import { useId } from 'react';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';

/**
 * Inline confirmation at the end of the brief. The job footer's Confirm brief is the surface's
 * primary action and calls the same `confirm` with the same blocker, so this one stays outline.
 */
export const ConfirmBrief = ({ model }: { model: ReturnType<typeof useApplicationBrief> }) => {
  const hintId = useId();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={model.confirmDisabled}
          aria-describedby={model.confirmationHint ? hintId : undefined}
          onClick={() => {
            void model.confirm();
          }}
        >
          Confirm complete brief and requirements
        </Button>
        <Button variant="outline" disabled={model.disabled} onClick={model.cancelEditing}>
          Cancel editing
        </Button>
      </div>
      {model.confirmationHint ? (
        <p id={hintId} className="quiet">
          {model.confirmationHint}
        </p>
      ) : null}
    </div>
  );
};
