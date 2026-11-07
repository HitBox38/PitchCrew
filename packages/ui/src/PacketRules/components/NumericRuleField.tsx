import { Input } from '@pitchcrew/design-system/input';
import { fieldNumber, ruleFormKey } from '../form-helpers.ts';
import { numericBounds, numericProblem } from '../numeric.ts';
import type { RuleFormProps } from './RuleFormBasics.tsx';

export const NumericRuleField = ({
  rule,
  index,
  change,
  field,
  label,
}: RuleFormProps & {
  field: 'max' | 'maxCount';
  label: string;
}) => {
  const problem = numericProblem(rule, field);
  const id = ruleFormKey(index, field);
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        type="number"
        {...numericBounds(rule, field)}
        step={1}
        value={fieldNumber(rule[field])}
        aria-invalid={!!problem}
        aria-describedby={problem ? `${id}-error` : undefined}
        onChange={(event) =>
          change({ [field]: event.target.value === '' ? null : Number(event.target.value) })
        }
      />
      {problem ? (
        <p id={`${id}-error`} className="form-error" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
};
