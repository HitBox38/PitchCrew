import type { ReasoningLevel, Role, RuntimeInfo } from '@pitchcrew/core';
import { useState } from 'react';
import { useModelCatalog } from '@/ModelField/hooks/useModelCatalog.ts';

export function useChatReasoning(role: Role, runtime: RuntimeInfo, thread: string) {
  const { catalog } = useModelCatalog(role.runtime, runtime);
  const [choices, setChoices] = useState<Record<string, string>>({});
  // Scope overrides to the thread, recipient, model and saved default.
  const key = JSON.stringify([thread, role.id, role.runtime, role.model, role.reasoning ?? null]);
  const reasoningOptions = catalog.models.find((model) => model.value === role.model)?.reasoning;
  const choice = choices[key] ?? 'agent';
  const reasoningChoice =
    choice === 'agent' ||
    choice === '' ||
    reasoningOptions?.levels.includes(choice as ReasoningLevel)
      ? choice
      : 'agent';
  const setReasoningChoice = (value: string) =>
    setChoices((current) => ({ ...current, [key]: value }));
  const reasoningInput =
    !reasoningOptions || reasoningChoice === 'agent'
      ? {}
      : { reasoning: reasoningChoice ? (reasoningChoice as ReasoningLevel) : null };
  return { reasoningOptions, reasoningChoice, setReasoningChoice, reasoningInput };
}
