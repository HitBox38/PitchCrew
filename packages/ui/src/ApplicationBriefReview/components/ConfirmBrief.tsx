import { Button } from '@pitchcrew/design-system/button';
import { useId } from 'react';
import type { useApplicationBrief } from '../hooks/useApplicationBrief.ts';

/**
 * The end of the brief editor. The job's dock holds the one Confirm brief action, enabled only
 * while this brief is on screen; this row keeps Cancel and the reason confirmation is unavailable.
 */
export const ConfirmBrief = ({ model }: { model: ReturnType<typeof useApplicationBrief> }) => {
  const hintId = useId();
  return (
    <div className="grid gap-2">
      {model.confirmationHint ? (
        <p id={hintId} className="quiet">
          {model.confirmationHint}
        </p>
      ) : null}
      <Button
        className="-ml-3 justify-self-start"
        variant="ghost"
        size="sm"
        disabled={model.disabled}
        onClick={model.cancelEditing}
      >
        Cancel editing
      </Button>
    </div>
  );
};
