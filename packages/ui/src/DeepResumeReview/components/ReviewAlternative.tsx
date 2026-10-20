import type { ReviewRuntimeAlternative } from '@pitchcrew/core';
import type { ReviewSupport } from '../types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { ModelField } from '@/ModelField/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Select } from '@/components/ui/select/constants.ts';
import { SelectContent } from '@/components/ui/select/components/SelectContent.tsx';
import { SelectItem } from '@/components/ui/select/components/SelectItem.tsx';
import { SelectTrigger } from '@/components/ui/select/components/SelectTrigger.tsx';
import { SelectValue } from '@/components/ui/select/components/SelectValue.tsx';
export const ReviewAlternative = ({
  value,
  index,
  runtimes,
  change,
  remove,
}: {
  value: ReviewRuntimeAlternative;
  index: number;
  runtimes: ReviewSupport[];
  change: (value: ReviewRuntimeAlternative) => void;
  remove: () => void;
}) => {
  const runtime = runtimes.find((item) => item.id === value.runtime);
  const items = runtimes
    .filter((item) => item.available && item.applicationIsolation && item.reviewSubagents)
    .map((item) => ({ value: item.id, label: runtimeLabels[item.id] }));
  return (
    <fieldset className="grid gap-3 rounded-xl border border-border p-3">
      <legend>Alternative {index + 1}</legend>
      <label htmlFor={`review-runtime-${index}`}>Runtime</label>
      <Select
        items={items}
        value={value.runtime}
        onValueChange={(next) => {
          if (next) change({ runtime: next, model: '', reasoning: null });
        }}
      >
        <SelectTrigger id={`review-runtime-${index}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ModelField
        key={value.runtime}
        id={`review-model-${index}`}
        runtime={value.runtime}
        available={runtime?.available ?? false}
        initialCatalog={
          runtime ?? { models: [], modelSource: 'none', modelDetail: 'Check runtimes in Settings.' }
        }
        value={value.model}
        onValueChange={(model) => change({ ...value, model })}
        reasoning={value.reasoning ?? null}
        onReasoningChange={(reasoning) => change({ ...value, reasoning })}
      />
      <Button variant="ghost" onClick={remove}>
        Remove alternative {index + 1}
      </Button>
    </fieldset>
  );
};
