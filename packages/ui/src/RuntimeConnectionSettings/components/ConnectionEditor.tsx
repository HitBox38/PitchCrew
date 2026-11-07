import { useEffect, useEffectEvent, useRef } from 'react';
import type { RuntimeId } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { useRuntimeConnection } from '../hooks/useRuntimeConnection.ts';
import { ConnectionFields } from './ConnectionFields.tsx';
import { ConnectionActions } from './ConnectionActions.tsx';
import { ConnectionRecovery } from './ConnectionRecovery.tsx';
export const ConnectionEditor = ({
  runtime,
  blocked,
  onDirtyChange,
  onWorkingChange,
  onSaved,
  recovery,
}: {
  runtime: RuntimeId;
  blocked: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onWorkingChange: (working: boolean) => void;
  onSaved: () => void;
  recovery?: boolean;
}) => {
  const model = useRuntimeConnection(runtime);
  const previousRecovery = useRef(recovery);
  const reload = useEffectEvent(model.reload);
  useEffect(() => {
    if (recovery && !previousRecovery.current) void reload();
    previousRecovery.current = recovery;
  }, [recovery]);
  useEffect(() => {
    onDirtyChange(model.dirty);
  }, [model.dirty, onDirtyChange]);
  useEffect(() => {
    onWorkingChange(model.working);
  }, [model.working, onWorkingChange]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      onWorkingChange(false);
    },
    [onDirtyChange, onWorkingChange],
  );
  const working = blocked || model.working;
  if (model.state?.readError)
    return (
      <ConnectionRecovery
        runtime={runtime}
        blocked={working}
        reload={model.reload}
        onWorkingChange={onWorkingChange}
        onSaved={onSaved}
        onRecovered={model.recovered}
      />
    );
  return (
    <div className="settings-stack pt-3">
      <p className="quiet">
        These settings apply to this runtime in this workspace. Secret values are hidden after
        saving and are never sent to the crew.
      </p>
      {model.error ? (
        <p className="form-error" role="alert">
          {model.error}
        </p>
      ) : null}
      <output className="quiet min-w-0 wrap-anywhere">{model.notice}</output>
      {!model.state ? (
        model.error ? (
          <div>
            <Button variant="outline" disabled={model.working} onClick={() => void model.reload()}>
              Retry loading settings
            </Button>
          </div>
        ) : (
          <p className="quiet">Loading authentication settings…</p>
        )
      ) : model.state.fields.length ? (
        <ConnectionFields model={model} working={working} />
      ) : (
        <p className="quiet">This runtime has no configurable authentication variables.</p>
      )}
      {blocked && !model.working ? (
        <p className="quiet">
          Wait for the current runtime operation to finish before saving authentication settings.
        </p>
      ) : null}
      <ConnectionActions model={model} working={working} onSaved={onSaved} />
    </div>
  );
};
