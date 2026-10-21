import { ReasoningField } from '@/ReasoningField/index.tsx';
import { reasoningLabels } from '@/lib/reasoning.ts';
import type { ReasoningLevel } from '@pitchcrew/core';
import type { ModelFieldProps, ModelFieldModel } from '../types.ts';

export const ModelReasoning = ({
  props,
  controller,
}: {
  props: ModelFieldProps;
  controller: ModelFieldModel;
}) => {
  const { id, catalog, value, available, loading } = controller;
  return (
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
  );
};
