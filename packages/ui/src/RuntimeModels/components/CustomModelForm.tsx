import { Button } from '@pitchcrew/design-system/button';
import type { ManagedRuntimeModel, RuntimeId, RuntimeModel } from '@pitchcrew/core';
import { useCustomModelForm } from '../hooks/useCustomModelForm.ts';
import { CustomModelReasoning } from './CustomModelReasoning.tsx';
import type { CustomRuntimeModel } from '../types.ts';
import { CustomModelBasics } from './CustomModelBasics.tsx';

export const CustomModelForm = ({
  runtime,
  existing,
  models,
  busy,
  cancel,
  save,
  onDirtyChange,
}: {
  runtime: RuntimeId;
  existing: RuntimeModel | null;
  models: ManagedRuntimeModel[];
  busy: boolean;
  cancel: () => void;
  save: (value: CustomRuntimeModel) => Promise<void>;
  onDirtyChange?: (value: boolean) => void;
}) => {
  const { field, ...form } = useCustomModelForm(existing, models, onDirtyChange);
  const supportsReasoning = [
    'codex',
    'claude-code',
    'opencode',
    'copilot-cli',
    'pi',
    'oh-my-pi',
  ].includes(runtime);
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = form.validate();
        if (value) void save(value);
      }}
    >
      <h5 className="font-semibold">{existing ? 'Edit custom model' : 'Add custom model'}</h5>
      <CustomModelBasics field={field} form={form} busy={busy} />
      <p className="quiet">
        Use the exact selector accepted by this CLI. Adding it does not configure a provider account
        or check model access.
      </p>
      {supportsReasoning ? (
        <CustomModelReasoning
          levels={form.levels}
          defaultLevel={form.defaultLevel}
          change={(levels, value) => {
            form.setLevels(levels);
            form.setDefaultLevel(value);
          }}
          disabled={busy}
        />
      ) : null}
      {form.error ? (
        <p className="form-error" role="alert">
          {form.error}
        </p>
      ) : null}
      <div className="settings-form-actions">
        <Button variant="ghost" disabled={busy} onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !form.value.trim() || !form.dirty}>
          Save model
        </Button>
      </div>
    </form>
  );
};
