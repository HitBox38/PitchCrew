import type { UserInputRequest } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { Check } from 'lucide-react';
/** The option's number key, shown as in T3 Code's question panel. */
const OptionKey = ({ index }: { index: number }) =>
  index < 9 ? (
    <kbd className="user-question-key" aria-hidden="true">
      {index + 1}
    </kbd>
  ) : null;

export const QuestionOptions = ({
  question,
  selected,
  disabled,
  choose,
}: {
  question: UserInputRequest;
  selected: string[];
  disabled: boolean;
  choose: (id: string) => void;
}) => {
  const selectedIds = new Set(selected);
  return (
    <fieldset
      className="user-question-options"
      data-question-choice-target={question.id}
      tabIndex={-1}
      aria-labelledby={`question-title-${question.id} question-options-${question.id}`}
      aria-describedby={question.reason ? `question-reason-${question.id}` : undefined}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      <legend id={`question-options-${question.id}`} className="sr-only">
        Suggested answers
      </legend>
      {question.options.map((option, index) =>
        question.multiSelect ? (
          <label
            key={option.id}
            className="user-question-option"
            data-selected={selectedIds.has(option.id)}
          >
            <OptionKey index={index} />
            <Checkbox
              checked={selectedIds.has(option.id)}
              disabled={disabled}
              onCheckedChange={() => choose(option.id)}
            />
            <span className="user-question-option-label">
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
            onClick={() => choose(option.id)}
            aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
          >
            <OptionKey index={index} />
            <span className="user-question-option-label">
              <strong>{option.label}</strong>
              {option.description ? <small>{option.description}</small> : null}
            </span>
            {selectedIds.has(option.id) ? <Check size={15} /> : null}
          </Button>
        ),
      )}
    </fieldset>
  );
};
