import { Input } from '@pitchcrew/design-system/input';
import { FormSelect } from '@/FormSelect/index.tsx';
import { fieldText, ruleFormKey } from '../form-helpers.ts';
import { NumericRuleField } from './NumericRuleField.tsx';
import type { RuleFormProps } from './RuleFormBasics.tsx';

export const RuleLimitFields = ({ rule, index, change }: RuleFormProps) => (
  <div className="settings-field-grid">
    <NumericRuleField
      rule={rule}
      index={index}
      change={change}
      field="max"
      label={rule.kind === 'word_limit' ? 'Maximum words' : 'Maximum bullets per section'}
    />
    {rule.kind === 'word_limit' ? (
      <FormSelect
        id={ruleFormKey(index, 'count')}
        label="Words to count"
        value={fieldText(rule.count) || 'body'}
        onValueChange={(count) => change({ count })}
        options={[
          { value: 'all', label: 'All words, including headings' },
          { value: 'body', label: 'Body text only' },
        ]}
      />
    ) : (
      <label htmlFor={ruleFormKey(index, 'heading')}>
        Section heading pattern (optional)
        <Input
          id={ruleFormKey(index, 'heading')}
          value={fieldText(rule.heading)}
          onChange={(event) => change({ heading: event.target.value || undefined })}
          autoComplete="off"
          spellCheck={false}
          maxLength={300}
          placeholder="Experience|Projects…"
        />
      </label>
    )}
  </div>
);
