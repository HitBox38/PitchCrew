import { useCallback, useState } from 'react';
import type { ManagedRuntimeModel, RuntimeModel } from '@pitchcrew/core';
import type { CustomRuntimeModel, RuntimeModelsModel } from '../types.ts';
import { CustomModelForm } from './CustomModelForm.tsx';
import { DiscardCustomModel } from './DiscardCustomModel.tsx';

export const RuntimeModelsEditor = ({
  editor,
  model,
  models,
  close,
  onDirtyChange,
}: {
  editor: RuntimeModel | 'new';
  model: RuntimeModelsModel;
  models: ManagedRuntimeModel[];
  close: () => void;
  onDirtyChange?: (value: boolean) => void;
}) => {
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const report = useCallback(
    (value: boolean) => {
      setDirty(value);
      onDirtyChange?.(value);
    },
    [onDirtyChange],
  );
  const save = async (entry: CustomRuntimeModel) => {
    const preferences = model.state!.preferences;
    const oldValue = editor === 'new' ? '' : editor.value;
    const migrate = (items: string[]) => [
      ...new Set(items.map((value) => (value === oldValue ? entry.value : value))),
    ];
    const custom = preferences.custom.filter((item) => item.value !== oldValue);
    if (
      await model.save({
        custom: [...custom, entry],
        favorite: migrate(preferences.favorite),
        hidden: migrate(preferences.hidden),
        order: migrate(preferences.order),
      })
    )
      close();
  };
  return (
    <>
      <CustomModelForm
        runtime={model.id}
        existing={editor === 'new' ? null : editor}
        models={models}
        busy={model.busy || model.recoveryNeeded}
        onDirtyChange={report}
        cancel={() => (dirty ? setDiscard(true) : close())}
        save={save}
      />
      <DiscardCustomModel
        open={discard}
        setOpen={setDiscard}
        discard={close}
        returnFocus={() =>
          document.getElementById(
            editor === 'new'
              ? `runtime-${model.id}-add-custom-model`
              : `runtime-${model.id}-edit-${editor.value}`,
          ) ?? document.getElementById(`runtime-${model.id}-add-custom-model`)
        }
      />
    </>
  );
};
