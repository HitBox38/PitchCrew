import {
  wordLimitBounds,
  bulletLimitBounds,
  matchCountBounds,
} from '@pitchcrew/core/packet-rule-options';

export const numericBounds = (rule: Record<string, unknown>, field: 'max' | 'maxCount') =>
  field === 'maxCount'
    ? matchCountBounds
    : rule.kind === 'word_limit'
      ? wordLimitBounds
      : bulletLimitBounds;
export const numericProblem = (rule: Record<string, unknown>, field: 'max' | 'maxCount') => {
  const { min, max } = numericBounds(rule, field);
  const value = rule[field];
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? ''
    : `Enter a whole number between ${min} and ${max.toLocaleString('en-US')}.`;
};
