export const numericBounds = (rule: Record<string, unknown>, field: 'max' | 'maxCount') => ({
  min: field === 'max' && rule.kind === 'word_limit' ? 1 : 0,
  max: field === 'max' && rule.kind === 'word_limit' ? 100000 : 1000,
});
export const numericProblem = (rule: Record<string, unknown>, field: 'max' | 'maxCount') => {
  const { min, max } = numericBounds(rule, field);
  const value = rule[field];
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? ''
    : `Enter a whole number between ${min} and ${max.toLocaleString('en-US')}.`;
};
