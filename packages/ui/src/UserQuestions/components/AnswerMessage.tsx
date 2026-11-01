import type { UserInputRequest } from '@pitchcrew/core';
import { Check } from 'lucide-react';
export const AnswerMessage = ({ question }: { question: UserInputRequest }) => {
  return (
    <div className="user-question-answer">
      {question.answer?.selected.length ? (
        <div className="user-answer-choices">
          {question.answer.selected.map((id) => (
            <span key={id}>
              <Check size={12} aria-hidden="true" />
              {question.options.find((option) => option.id === id)?.label ?? id}
            </span>
          ))}
        </div>
      ) : null}
      {question.answer?.text ? <p>{question.answer.text}</p> : null}
    </div>
  );
};
