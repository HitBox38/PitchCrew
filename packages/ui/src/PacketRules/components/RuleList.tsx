import { issueText, issuesForRule } from '../helpers.ts';
import type { RuleIssue, RuleView } from '../types.ts';

export function RuleList({ rules, issues }: { rules: RuleView[]; issues: RuleIssue[] }) {
  if (!rules.length)
    return <p className="quiet">No house rules. Only the exact quotation checks run.</p>;
  return (
    <ul className="packet-rule-list" aria-label="Packet rules">
      {rules.map((rule) => {
        const problems = issuesForRule(issues, rule.index);
        return (
          <li
            key={rule.index}
            className="packet-rule"
            data-invalid={problems.length > 0 || undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-semibold">{rule.id}</code>
              <span className="badge">{rule.kind}</span>
              <span className={`badge packet-rule-${rule.severity}`}>
                {rule.severity === 'warn'
                  ? 'Warning'
                  : rule.severity === 'error'
                    ? 'Error'
                    : rule.severity}
              </span>
              <span className="quiet">{rule.documents}</span>
            </div>
            <p className="mt-1 wrap-anywhere">{rule.detail}</p>
            {problems.length ? (
              <ul className="form-error mt-2" role="alert">
                {problems.map((issue, index) => (
                  <li key={index}>{issueText(issue)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
