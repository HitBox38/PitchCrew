import type { ReasoningLevel } from '@pitchcrew/core';

export const reasoningLabels: Record<ReasoningLevel, string> = {
  none: 'None',
  off: 'Off',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Maximum',
  ultra: 'Ultra',
};
