import type { UserInputRequest } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Checkbox } from '@/components/ui/checkbox/index.tsx';
import { Check } from 'lucide-react';
export const QuestionOptions = ({
  question,
  selected,
  disabled,
  toggleOption,
}: {
  question: UserInputRequest;
  selected: string[];
  disabled: boolean;
  toggleOption: (id: string) => void;
}) => {
  const selectedIds = new Set(selected);
  return (
    <div className="user-question-options" aria-label="Suggested answers">
      {question.options.map((option) =>
        question.multiSelect ? (
          <label
            key={option.id}
            className="user-question-option"
            data-selected={selectedIds.has(option.id)}
          >
            <Checkbox
              checked={selectedIds.has(option.id)}
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
            aria-pressed={selectedIds.has(option.id)}
            disabled={disabled}
            onClick={() => toggleOption(option.id)}
          >
            <span>
              <strong>{option.label}</strong>
              {option.description ? <small>{option.description}</small> : null}
            </span>
            {selectedIds.has(option.id) ? <Check size={15} /> : null}
          </Button>
        ),
      )}
    </div>
  );
};
