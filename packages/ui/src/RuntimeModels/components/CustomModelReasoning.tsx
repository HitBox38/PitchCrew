import { Checkbox } from '@pitchcrew/design-system/checkbox';
import type { ReasoningLevel } from '@pitchcrew/core';
import { reasoningLevels } from '@pitchcrew/core/reasoning';
import { FormSelect } from '@/FormSelect/index.tsx';
import { reasoningLabels } from '@/lib/reasoning.ts';

export const CustomModelReasoning = ({
  levels,
  defaultLevel,
  change,
  disabled,
}: {
  levels: ReasoningLevel[];
  defaultLevel: string;
  change: (levels: ReasoningLevel[], defaultLevel: string) => void;
  disabled: boolean;
}) => (
  <fieldset disabled={disabled} className="space-y-3">
    <legend className="settings-legend">Reasoning controls (optional)</legend>
    <p className="quiet">
      Only choose levels this model and runtime support. Pitchcrew does not verify custom model
      capabilities.
    </p>
    <p className="quiet">
      Names are runtime-specific: None and Off are different CLI values. Select only the names your
      CLI documents.
    </p>
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {reasoningLevels.map((level) => (
        <label className="checkbox-label flex min-h-11 items-center gap-2" key={level}>
          <Checkbox
            disabled={disabled}
            checked={levels.includes(level)}
            onCheckedChange={(checked) => {
              const next = checked ? [...levels, level] : levels.filter((value) => value !== level);
              change(next, next.includes(defaultLevel as ReasoningLevel) ? defaultLevel : '');
            }}
          />
          {reasoningLabels[level]}
        </label>
      ))}
    </div>
    {levels.length ? (
      <FormSelect
        id="custom-model-default-reasoning"
        label="Model's default reasoning"
        value={defaultLevel}
        onValueChange={(value) => change(levels, value)}
        options={[
          { value: '', label: 'Not specified' },
          ...levels.map((value) => ({ value, label: reasoningLabels[value] })),
        ]}
      />
    ) : null}
  </fieldset>
);
