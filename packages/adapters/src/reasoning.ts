import { reasoningLevels, type ModelReasoning, type ReasoningLevel } from '@pitchcrew/core';

/** Retain only recognized effort names, never arbitrary native catalog metadata. */
export function modelReasoning(
  levels: unknown,
  defaultLevel?: unknown,
): ModelReasoning | undefined {
  if (!Array.isArray(levels)) return undefined;
  const supported = [
    ...new Set(
      levels.filter(
        (level): level is ReasoningLevel =>
          typeof level === 'string' && reasoningLevels.includes(level as ReasoningLevel),
      ),
    ),
  ];
  if (!supported.length) return undefined;
  return {
    levels: supported,
    ...(supported.includes(defaultLevel as ReasoningLevel)
      ? { default: defaultLevel as ReasoningLevel }
      : {}),
  };
}

// Pi's native thinking switch is common across its reasoning models. The CLI
// clamps provider-specific budgets; non-reasoning rows never get this control.
export const piReasoning: ModelReasoning = {
  levels: ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
};
