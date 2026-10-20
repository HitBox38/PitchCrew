import { ModelPicker } from '@/ModelField/components/ModelPicker.tsx';
import { RefreshModels } from '@/ModelField/components/RefreshModels.tsx';
import { useModelField } from '@/ModelField/hooks/useModelField.ts';
import type { ModelFieldProps } from '@/ModelField/types.ts';
import { ReasoningField } from '@/ReasoningField/index.tsx';
import type { ReasoningLevel } from '@pitchcrew/core';
import { reasoningLabels } from '@/lib/reasoning.ts';
import { agentModelDefaultValue } from './constants.ts';

export const ModelField = (props: ModelFieldProps) => {
  const controller = useModelField(props);
  const { id, runtime, available, value, onValueChange, catalog, loading, refreshModels, error } =
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
          {!available
            ? catalog.modelSource === 'none'
              ? catalog.modelDetail
              : 'This runtime is unavailable. Install it before starting agent work.'
            : loading
              ? 'Loading models from the runtime…'
              : error || catalog.modelDetail}
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
      <ReasoningField
        id={`${id}-reasoning`}
        conversation={props.conversation}
        reasoning={catalog.models.find((model) => model.value === value)?.reasoning}
        value={props.inheritReasoning ? 'agent' : (props.reasoning ?? '')}
        agentDefault={
          props.agentDefaults
            ? `Use agent default (${props.agentDefaults.reasoning ? reasoningLabels[props.agentDefaults.reasoning] : 'CLI default'})`
            : undefined
        }
        onValueChange={(next) => {
          if (next === 'agent') props.onInheritReasoning?.();
          else props.onReasoningChange(next ? (next as ReasoningLevel) : null);
        }}
        disabled={!available || loading}
      />
    </>
  );
};
