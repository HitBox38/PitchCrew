import { Button } from '@/components/ui/button/components/Button.tsx';
import { ruleFormKey, type RuleDraft } from '../form-helpers.ts';
import { kindLabels } from '../constants.ts';
import { issuesForRule, ruleSentence } from '../helpers.ts';
import type { RuleIssue } from '../types.ts';

/** One rule row, titled by its condition with the saved severity as a chip. */
export const RuleListItem = ({
  rule,
  index,
  issues,
  selected,
  select,
}: {
  rule: RuleDraft;
  index: number;
  issues: RuleIssue[];
  selected: boolean;
  select: () => void;
}) => {
  const problems = issuesForRule(issues, index).length;
  return (
    <li>
      <Button
        variant="ghost"
        id={ruleFormKey(index, 'trigger')}
        className="packet-rule-row"
        aria-current={selected || undefined}
        data-invalid={problems > 0 || undefined}
        onClick={select}
      >
        <span className="packet-rule-title">{ruleSentence(rule)}</span>
        <span className="packet-rule-meta">
          <span className="ui-chip" data-tone={problems ? 'rose' : undefined}>
            {problems
              ? `${problems} to fix`
              : rule.severity === 'error'
                ? 'Blocks packet'
                : 'Warning'}
          </span>
          {kindLabels[rule.kind]}
        </span>
      </Button>
    </li>
  );
};
