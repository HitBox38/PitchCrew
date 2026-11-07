import { Button } from '@pitchcrew/design-system/button';
import type { RuntimeModelsModel } from '../types.ts';
import { RecoverModelChoices } from './RecoverModelChoices.tsx';
export const RuntimeModelsFeedback = ({ model }: { model: RuntimeModelsModel }) => (
  <>
    {model.recoveryNeeded ? (
      <div className="settings-stack settings-callout runtime-model-notice" role="alert">
        <p>
          Saved model choices cannot be read. Recover them to restore custom definitions and
          editing.
        </p>
        <p className="quiet">
          The native catalog below is read-only until recovery. Saved agent and conversation
          selections are kept.
        </p>
        <div className="settings-row-actions">
          <RecoverModelChoices runtime={model.id} reload={model.reload} />
        </div>
      </div>
    ) : null}
    {model.error ? (
      <div className="settings-stack">
        <p
          role="alert"
          className={
            model.conflictReloaded ? 'settings-callout runtime-model-notice' : 'form-error'
          }
        >
          {model.error}
        </p>
        {!model.conflictReloaded ? (
          <Button
            variant="outline"
            size="sm"
            disabled={model.busy}
            onClick={() => void model.reload()}
          >
            Reload model choices
          </Button>
        ) : null}
      </div>
    ) : null}
  </>
);
