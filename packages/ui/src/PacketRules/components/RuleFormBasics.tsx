import { Input } from '@/components/ui/input/components/Input.tsx';
import { Checkbox } from '@/components/ui/checkbox/components/Checkbox.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { documentLabels } from '../constants.ts';
import { fieldDocuments, fieldText, ruleFormKey, type RuleDraft } from '../form-helpers.ts';

export interface RuleFormProps {
  rule: RuleDraft;
  index: number;
  change: (patch: Record<string, unknown>) => void;
}
export const RuleFormBasics = ({ rule, index, change }: RuleFormProps) => {
  const documents = fieldDocuments(rule);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 max-compact:grid-cols-1">
        <div>
          <label htmlFor={ruleFormKey(index, 'id')}>Rule name</label>
          <Input
            id={ruleFormKey(index, 'id')}
            value={fieldText(rule.id)}
            onChange={(event) => change({ id: event.target.value })}
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
            aria-describedby={ruleFormKey(index, 'id-help')}
          />
          <p id={ruleFormKey(index, 'id-help')} className="quiet mt-1">
            Use lowercase words separated by dashes.
          </p>
        </div>
        <FormSelect
          id={ruleFormKey(index, 'severity')}
          label="When this rule fails"
          value={fieldText(rule.severity)}
          onValueChange={(severity) => change({ severity })}
          options={[
            { value: 'error', label: 'Block the packet' },
            { value: 'warn', label: 'Show a warning' },
          ]}
        />
      </div>
      <fieldset>
        <legend className="mb-2 font-semibold">Apply to</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {Object.entries(documentLabels).map(([value, label]) => (
            <label className="checkbox-label" key={value}>
              <Checkbox
                checked={documents.includes(value)}
                onCheckedChange={(checked) =>
                  change({
                    documents: checked
                      ? [...documents, value]
                      : documents.filter((entry) => entry !== value),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
};
