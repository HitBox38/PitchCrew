import type { UserInputRequest } from '@pitchcrew/core';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { QuestionOptions } from './QuestionOptions.tsx';
import type { useQuestionAnswer } from '../hooks/useQuestionAnswer.ts';
import { submitsAnswer } from '../helpers.ts';

type QuestionAnswerFieldsProps = {
  question: UserInputRequest;
  form: ReturnType<typeof useQuestionAnswer>;
};

/**
 * The question and its options scroll together; the labelled free answer stays outside that
 * scrollport, directly above the actions, so it is always visible. The form owns submission.
 */
export const QuestionAnswerFields = ({ question, form }: QuestionAnswerFieldsProps) => (
  <>
    <div className="user-question-fields">
      <p className="user-question-title">{question.question}</p>
      {question.reason ? <p className="user-question-reason">{question.reason}</p> : null}
      {question.multiSelect && question.options.length ? (
        <small>Choose any that apply.</small>
      ) : null}
      <QuestionOptions
        question={question}
        selected={form.selected}
        disabled={form.disabled}
        choose={form.choose}
      />
    </div>
    <div className="user-question-custom">
      <label htmlFor={`answer-${question.id}`} className="user-question-custom-label">
        {question.options.length ? 'Or write your own answer' : 'Your answer'}
      </label>
      <Textarea
        id={`answer-${question.id}`}
        value={form.text}
        disabled={form.disabled}
        maxLength={8000}
        onChange={(event) => form.setText(event.target.value)}
        onKeyDown={(event) => {
          if (!submitsAnswer({ ...event, isComposing: event.nativeEvent.isComposing })) return;
          event.preventDefault();
          if (!form.disabled && form.canAnswer) event.currentTarget.form?.requestSubmit();
        }}
        placeholder={
          question.options.length ? 'Add detail or answer in your words…' : 'Write an answer…'
        }
        rows={1}
      />
      {form.error ? (
        <p className="form-error" role="alert">
          {form.error}
        </p>
      ) : null}
    </div>
  </>
);
