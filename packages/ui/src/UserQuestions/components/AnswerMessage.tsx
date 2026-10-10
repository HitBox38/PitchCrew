import type { UserInputRequest } from '@pitchcrew/core';
export function AnswerMessage({ question }: { question: UserInputRequest }) {
  return (
    <div className="user-question-answer">
      {question.answer?.selected.length ? (
        <div className="user-answer-choices">
          {question.answer.selected.map((id) => (
            <span key={id}>{question.options.find((option) => option.id === id)?.label ?? id}</span>
          ))}
        </div>
      ) : null}
      {question.answer?.text ? <p>{question.answer.text}</p> : null}
    </div>
  );
}
