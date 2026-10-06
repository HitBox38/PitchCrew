export const reasoningLevels = [
  'none',
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
  'ultra',
] as const;
export type ReasoningLevel = (typeof reasoningLevels)[number];
export interface ModelReasoning {
  levels: readonly ReasoningLevel[];
  default?: ReasoningLevel;
}
