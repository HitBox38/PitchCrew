import { Input } from '@/components/ui/input/components/Input.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { fieldNumber, fieldText, ruleFormKey } from '../form-helpers.ts';
import type { RuleFormProps } from './RuleFormBasics.tsx';

export const RuleLimitFields = ({ rule, index, change }: RuleFormProps) => (
  <div className="grid grid-cols-2 gap-4 max-compact:grid-cols-1">
    <label htmlFor={ruleFormKey(index, 'max')}>
      {rule.kind === 'word_limit' ? 'Maximum words' : 'Maximum bullets per section'}
      <Input
        id={ruleFormKey(index, 'max')}
        type="number"
        min={rule.kind === 'word_limit' ? 1 : 0}
        max={rule.kind === 'word_limit' ? 100000 : 1000}
        step={1}
        value={fieldNumber(rule.max)}
        onChange={(event) =>
          change({ max: event.target.value === '' ? null : Number(event.target.value) })
        }
      />
    </label>
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
