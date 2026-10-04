import { documentLabels, kindLabels } from './constants.ts';
import type { DraftResult, RuleIssue, RuleView } from './types.ts';

export function formatRules(rules: unknown): string {
  return `${JSON.stringify(rules, null, 2)}\n`;
}

export function parseDraft(text: string): DraftResult {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      error: `This is not valid JSON. ${error instanceof Error ? error.message : ''}`.trim(),
    };
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const regex = (rule: Record<string, unknown>, field: string) =>
  `/${text(rule[field])}/${text(rule.flags)}`;

export function ruleDetail(rule: Record<string, unknown>): string {
  if (rule.kind === 'word_limit')
    return `At most ${String(rule.max)} ${rule.count === 'all' ? 'words' : 'body words'}.`;
  if (rule.kind === 'max_bullets')
    return `At most ${String(rule.max)} bullets per section${rule.heading ? `, for sections headed by lines matching ${regex(rule, 'heading')}` : ''}.`;
  if (rule.kind === 'canonical_lines') {
    const values = Array.isArray(rule.values) ? rule.values.length : 0;
    return `Lines matching ${regex(rule, 'selector')} must equal one of ${values} listed ${values === 1 ? 'entry' : 'entries'}.`;
  }
  if (rule.kind === 'pattern')
    return rule.equals !== undefined
      ? `Every match of ${regex(rule, 'pattern')} must capture “${text(rule.equals)}”.`
      : `At most ${typeof rule.maxCount === 'number' ? rule.maxCount : 0} matches of ${regex(rule, 'pattern')}.`;
  return 'Unknown rule kind.';
}

/** Readable rows for whatever the draft holds, even when parts of it are invalid. */
export function ruleViews(value: unknown): RuleView[] {
  const rules = (value as { rules?: unknown } | null)?.rules;
  if (!Array.isArray(rules)) return [];
  return rules.map((item, index) => {
    const rule = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const documents = Array.isArray(rule.documents)
      ? rule.documents.map((document) => documentLabels[String(document)] ?? String(document))
      : [];
    return {
      index,
      id: text(rule.id) || `Rule ${index + 1}`,
      kind: kindLabels[text(rule.kind)] ?? 'Unknown kind',
      severity: text(rule.severity) || 'unset',
      documents: documents.join(', ') || 'No documents',
      detail: text(rule.message) || ruleDetail(rule),
    };
  });
}

export const issuesForRule = (issues: RuleIssue[], index: number) =>
  issues.filter((issue) => issue.path[0] === 'rules' && issue.path[1] === index);
export const fileIssues = (issues: RuleIssue[]) =>
  issues.filter((issue) => !(issue.path[0] === 'rules' && typeof issue.path[1] === 'number'));

/** Paths inside a rule drop their `rules.N` prefix because the rule is already shown. */
export function issueText(issue: RuleIssue): string {
  const inRule = issue.path[0] === 'rules' && typeof issue.path[1] === 'number';
  const path = (inRule ? issue.path.slice(2) : issue.path).join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
