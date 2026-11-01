import { Textarea } from '@pitchcrew/design-system/textarea';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';
import { Trash2 } from 'lucide-react';
import { fieldText, ruleFormKey } from '../form-helpers.ts';
import { issuesForRule, issueText, ruleDetail } from '../helpers.ts';
import type { RuleIssue } from '../types.ts';
import { RuleFormBasics, type RuleFormProps } from './RuleFormBasics.tsx';
import { RuleLimitFields } from './RuleLimitFields.tsx';
import { RulePatternFields } from './RulePatternFields.tsx';

export const RuleForm = (
  props: RuleFormProps & { issues: RuleIssue[]; remove: () => void; working: boolean },
) => {
  const { rule, index, change, issues, remove, working } = props;
  const problems = issuesForRule(issues, index);
  return (
    <fieldset
      className="form packet-rule-form"
      disabled={working}
      aria-label={`Edit rule ${fieldText(rule.id)}`}
    >
      <RuleFormBasics {...props} />
      {rule.kind === 'word_limit' || rule.kind === 'max_bullets' ? (
        <RuleLimitFields {...props} />
      ) : (
        <RulePatternFields {...props} />
      )}
      {rule.kind !== 'word_limit' ? (
        <div className="packet-rule-flags">
          <label htmlFor={ruleFormKey(index, 'flags')}>Pattern flags (optional)</label>
          <Input
            id={ruleFormKey(index, 'flags')}
            value={fieldText(rule.flags)}
            onChange={(event) => change({ flags: event.target.value })}
            maxLength={4}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={ruleFormKey(index, 'flags-help')}
          />
          <p id={ruleFormKey(index, 'flags-help')} className="quiet mt-1">
            i ignores case; m matches line boundaries; s includes line breaks; u enables Unicode.
          </p>
        </div>
      ) : null}
      <label htmlFor={ruleFormKey(index, 'message')}>
        Message shown when the rule fails (optional)
        <Textarea
          id={ruleFormKey(index, 'message')}
          rows={2}
          value={fieldText(rule.message)}
          onChange={(event) => change({ message: event.target.value || undefined })}
          maxLength={300}
        />
      </label>
      <p className="packet-rule-summary">
        <strong>Checks:</strong> {ruleDetail(rule)}
      </p>
      {problems.length ? (
        <ul className="form-error" role="alert">
          {problems.map((issue, position) => (
            <li key={position}>{issueText(issue)}</li>
          ))}
        </ul>
      ) : null}
      <div>
        <Button variant="destructive" size="sm" onClick={remove}>
          <Trash2 size={14} aria-hidden="true" /> Remove rule
        </Button>
      </div>
    </fieldset>
  );
};
