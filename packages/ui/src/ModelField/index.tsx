import { ModelReasoning } from './components/ModelReasoning.tsx';
import { modelStatus } from './helpers.ts';
import { ModelPicker } from '@/ModelField/components/ModelPicker.tsx';
import { RefreshModels } from '@/ModelField/components/RefreshModels.tsx';
import { useModelField } from '@/ModelField/hooks/useModelField.ts';
import type { ModelFieldProps } from '@/ModelField/types.ts';
import { agentModelDefaultValue } from './constants.ts';

export const ModelField = (props: ModelFieldProps) => {
  const controller = useModelField(props);
  const { id, runtime, available, value, onValueChange, catalog, loading, refreshModels } =
    controller;
  return (
    <>
      <div className="field">
        <div className="model-field-heading flex items-center justify-between gap-2">
          <label htmlFor={id}>Model</label>
          {runtime !== 'demo' && <RefreshModels loading={loading} refresh={refreshModels} />}
        </div>
        <ModelPicker
          id={id}
          models={catalog.models}
          value={props.inheritModel ? agentModelDefaultValue : value}
          agentDefault={
            props.agentDefaults
              ? {
                  value: agentModelDefaultValue,
                  label: `Use agent default (${props.agentDefaults.model || 'CLI default'})`,
                }
              : undefined
          }
          onValueChange={(next) => {
            if (props.agentDefaults && next === agentModelDefaultValue) {
              props.onInheritModel?.();
              return;
            }
            onValueChange(next);
            if (next !== value) props.onReasoningChange(null);
          }}
          disabled={!available || runtime === 'demo'}
        />
        <output className="optional" aria-live="polite">
          {modelStatus(controller)}
        </output>
        {runtime !== 'demo' && !loading && (
          <span className="optional">
            {catalog.modelSource === 'runtime' ? 'Runtime models' : 'Suggested models'} · CLI
            default uses your runtime’s default.
          </span>
        )}
        {runtime !== 'demo' && !value ? (
          <span className="optional">Choose a model to configure its reasoning.</span>
        ) : null}
      </div>
      <ModelReasoning props={props} controller={controller} />
    </>
  );
};
