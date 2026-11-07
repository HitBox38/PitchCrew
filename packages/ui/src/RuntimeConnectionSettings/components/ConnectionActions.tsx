import { Button } from '@pitchcrew/design-system/button';
import type { useRuntimeConnection } from '../hooks/useRuntimeConnection.ts';
export const ConnectionActions = ({
  model,
  working,
  onSaved,
}: {
  model: ReturnType<typeof useRuntimeConnection>;
  working: boolean;
  onSaved: () => void;
}) => (
  <div className="settings-row-actions">
    <Button
      disabled={working || !model.dirty || !!Object.keys(model.incomplete).length}
      onClick={() =>
        void model.save().then((saved) => {
          if (saved) onSaved();
        })
      }
    >
      {model.working
        ? 'Saving…'
        : `Save authentication settings${Object.keys(model.changes).length > 1 ? ` (${Object.keys(model.changes).length})` : ''}`}
    </Button>
    <Button variant="ghost" disabled={model.working || !model.dirty} onClick={model.discard}>
      Discard changes
    </Button>
  </div>
);
