import type { UserInputRequest } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
import { Check } from 'lucide-react';
export function QuestionOptions({
  question,
  selected,
  disabled,
  toggleOption,
}: {
  question: UserInputRequest;
  selected: string[];
  disabled: boolean;
  toggleOption: (id: string) => void;
}) {
  return (
    <div className="user-question-options" aria-label="Suggested answers">
      {question.options.map((option) =>
        question.multiSelect ? (
          <label
            key={option.id}
            className="user-question-option"
            data-selected={selected.includes(option.id)}
          >
            <Checkbox
              checked={selected.includes(option.id)}
              disabled={disabled}
              onCheckedChange={() => toggleOption(option.id)}
            />
            <span>
              <strong>{option.label}</strong>
              {option.description ? <small>{option.description}</small> : null}
            </span>
          </label>
        ) : (
          <Button
            key={option.id}
            variant="outline"
            className="user-question-option"
            aria-pressed={selected.includes(option.id)}
            disabled={disabled}
            onClick={() => toggleOption(option.id)}
          >
            <span>
              <strong>{option.label}</strong>
              {option.description ? <small>{option.description}</small> : null}
            </span>
            {selected.includes(option.id) ? <Check size={15} /> : null}
          </Button>
        ),
      )}
    </div>
  );
}
