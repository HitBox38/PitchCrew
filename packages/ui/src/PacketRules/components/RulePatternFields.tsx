import { Input } from '@pitchcrew/design-system/input';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { FormSelect } from '@/FormSelect/index.tsx';
import { fieldText, ruleFormKey } from '../form-helpers.ts';
import { NumericRuleField } from './NumericRuleField.tsx';
import type { RuleFormProps } from './RuleFormBasics.tsx';

export const RulePatternFields = ({ rule, index, change }: RuleFormProps) => {
  const canonical = rule.kind === 'canonical_lines';
  const exact = rule.equals !== undefined;
  const field = canonical ? 'selector' : 'pattern';
  return (
    <>
      <label htmlFor={ruleFormKey(index, field)}>
        {canonical ? 'Lines to check (regular expression)' : 'Text to match (regular expression)'}
        <Input
          id={ruleFormKey(index, field)}
          value={fieldText(rule[field])}
          onChange={(event) => change({ [field]: event.target.value })}
          autoComplete="off"
          spellCheck={false}
          maxLength={300}
        />
      </label>
      {canonical ? (
        <div>
          <label htmlFor={ruleFormKey(index, 'values')}>Allowed lines</label>
          <Textarea
            id={ruleFormKey(index, 'values')}
            rows={4}
            aria-describedby={ruleFormKey(index, 'values-help')}
            value={Array.isArray(rule.values) ? rule.values.map(fieldText).join('\n') : ''}
            onChange={(event) => change({ values: event.target.value.split('\n') })}
          />
          <p id={ruleFormKey(index, 'values-help')} className="quiet mt-1">
            Enter one complete allowed line per row.
          </p>
        </div>
      ) : (
        <div className="settings-field-grid">
          <FormSelect
            id={ruleFormKey(index, 'match')}
            label="Check"
            value={exact ? 'equals' : 'count'}
            onValueChange={(mode) =>
              change(
                mode === 'equals'
                  ? { equals: '', maxCount: undefined }
                  : { maxCount: 0, equals: undefined },
              )
            }
            options={[
              { value: 'count', label: 'Limit the number of matches' },
              { value: 'equals', label: 'Require an exact captured value' },
            ]}
          />
          {exact ? (
            <label htmlFor={ruleFormKey(index, 'equals')}>
              Required captured value
              <Input
                id={ruleFormKey(index, 'equals')}
                value={fieldText(rule.equals)}
                onChange={(event) => change({ equals: event.target.value })}
                maxLength={300}
                autoComplete="off"
              />
            </label>
          ) : (
            <NumericRuleField
              rule={{ ...rule, maxCount: rule.maxCount === undefined ? 0 : rule.maxCount }}
              index={index}
              change={change}
              field="maxCount"
              label="Maximum matches"
            />
          )}
        </div>
      )}
    </>
  );
};
