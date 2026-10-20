import type { PacketRule } from '@pitchcrew/core';

export type RuleKind = PacketRule['kind'];
export type RuleDraft = Record<string, unknown> & { kind: RuleKind };
export interface RulesDocument {
  version: 1;
  rules: RuleDraft[];
  [key: string]: unknown;
}
export const ruleKinds: { value: RuleKind; label: string }[] = [
  { value: 'word_limit', label: 'Word limit' },
  { value: 'max_bullets', label: 'Bullets per section' },
  { value: 'canonical_lines', label: 'Allowed lines' },
  { value: 'pattern', label: 'Text pattern' },
];

/** Preserve incomplete fields and unknown properties until the daemon validates them. */
export const editableDocument = (value: unknown): RulesDocument | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const document = value as Record<string, unknown>;
  if (document.version !== 1 || !Array.isArray(document.rules) || document.rules.length > 100)
    return null;
  if (
    !document.rules.every(
      (rule) =>
        rule &&
        typeof rule === 'object' &&
        !Array.isArray(rule) &&
        ruleKinds.some((kind) => kind.value === rule.kind),
    )
  )
    return null;
  return document as RulesDocument;
};
export const fieldText = (value: unknown) => (typeof value === 'string' ? value : '');
export const fieldNumber = (value: unknown) => (typeof value === 'number' ? value : '');
export const fieldDocuments = (rule: RuleDraft) =>
  Array.isArray(rule.documents)
    ? rule.documents.filter((value): value is string => typeof value === 'string')
    : [];
export const ruleFormKey = (index: number, field: string) => `packet-rule-${index}-${field}`;

export const newRule = (kind: RuleKind, rules: RuleDraft[]): RuleDraft => {
  const prefix = kind.replaceAll('_', '-');
  let suffix = 1;
  while (rules.some((rule) => rule.id === `${prefix}-${suffix}`)) suffix++;
  const base = { id: `${prefix}-${suffix}`, severity: 'warn', documents: ['resume'] };
  if (kind === 'word_limit') return { ...base, kind, max: 650, count: 'all' };
  if (kind === 'max_bullets') return { ...base, kind, max: 5, flags: '' };
  if (kind === 'canonical_lines') return { ...base, kind, selector: '', flags: '', values: [''] };
  return { ...base, kind, pattern: '', flags: '', maxCount: 0 };
};
