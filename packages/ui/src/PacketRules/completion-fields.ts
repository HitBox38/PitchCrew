export const ruleFields: Record<string, { detail: string; value: string }> = {
  id: { detail: 'Unique lowercase rule name', value: '""' },
  kind: { detail: 'Rule type', value: '"word_limit"' },
  severity: { detail: 'Block or warn when the rule fails', value: '"warn"' },
  documents: { detail: 'Documents this rule checks', value: '["resume"]' },
  message: { detail: 'Optional explanation shown when the rule fails', value: '""' },
  max: { detail: 'Maximum word or bullet count', value: '650' },
  count: { detail: 'Count all words or body words', value: '"body"' },
  heading: { detail: 'Optional section heading pattern', value: '""' },
  flags: { detail: 'Regular expression flags: i, m, s, u', value: '""' },
  selector: { detail: 'Pattern selecting lines to check', value: '""' },
  values: { detail: 'Allowed exact lines', value: '[""]' },
  pattern: { detail: 'Text pattern to check', value: '""' },
  maxCount: { detail: 'Maximum number of matches', value: '0' },
  equals: { detail: 'Required exact captured value', value: '""' },
};
export const fieldsByKind: Record<string, string[]> = {
  word_limit: ['max', 'count'],
  max_bullets: ['max', 'heading', 'flags'],
  canonical_lines: ['selector', 'flags', 'values'],
  pattern: ['pattern', 'flags', 'maxCount', 'equals'],
};
export const enumValues: Record<string, (string | number)[]> = {
  version: [1],
  kind: ['word_limit', 'max_bullets', 'canonical_lines', 'pattern'],
  severity: ['error', 'warn'],
  documents: ['resume', 'coverLetter', 'formAnswers', 'note'],
  count: ['body', 'all'],
};
