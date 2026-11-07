import type { UserInputRequest } from '@pitchcrew/core';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { QuestionOptions } from './QuestionOptions.tsx';
import type { useQuestionAnswer } from '../hooks/useQuestionAnswer.ts';
import { submitsAnswer } from '../helpers.ts';
import { QuestionChoicesViewport } from './QuestionChoicesViewport.tsx';
import { QuestionAnswerFeedback } from './QuestionAnswerFeedback.tsx';

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
    <QuestionChoicesViewport>
      <p id={`question-title-${question.id}`} className="user-question-title">
        {question.question}
      </p>
      {question.reason ? (
        <p id={`question-reason-${question.id}`} className="user-question-reason">
          {question.reason}
        </p>
      ) : null}
      {question.multiSelect && question.options.length ? (
        <small>Choose any that apply.</small>
      ) : null}
      <QuestionOptions
        question={question}
        selected={form.selected}
        disabled={form.disabled}
        choose={form.choose}
      />
    </QuestionChoicesViewport>
    <div className="user-question-custom">
      <label htmlFor={`answer-${question.id}`} className="user-question-custom-label">
        {question.options.length
          ? question.multiSelect
            ? 'Add detail (optional)'
            : 'Or write your own answer'
          : 'Your answer'}
      </label>
      <Textarea
        id={`answer-${question.id}`}
        data-question-answer-target="true"
        className="user-question-answer-input"
        value={form.text}
        readOnly={form.disabled}
        aria-readonly={form.disabled}
        aria-invalid={!!form.error}
        aria-describedby={[
          `question-title-${question.id}`,
          question.reason && `question-reason-${question.id}`,
          form.error && `answer-error-${question.id}`,
          form.notice && `answer-status-${question.id}`,
        ]
          .filter(Boolean)
          .join(' ')}
        maxLength={8000}
        onChange={(event) => form.setText(event.target.value)}
        onKeyDown={(event) => {
          if (!submitsAnswer({ ...event, isComposing: event.nativeEvent.isComposing })) return;
          event.preventDefault();
          if (!form.disabled && form.canAnswer) event.currentTarget.form?.requestSubmit();
        }}
        placeholder={question.options.length ? 'Add detail…' : 'Write an answer…'}
        rows={1}
      />
      <QuestionAnswerFeedback id={question.id} form={form} />
    </div>
  </>
);
