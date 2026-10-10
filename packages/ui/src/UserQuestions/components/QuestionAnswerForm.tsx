import { Button } from '@/components/ui/button/components/Button.tsx';
import { Textarea } from '@/components/ui/textarea/index.tsx';
import { QuestionOptions } from './QuestionOptions.tsx';
import { useQuestionAnswer } from '../hooks/useQuestionAnswer.ts';
import type { QuestionFormProps } from '../types.ts';
export function QuestionAnswerForm(props: QuestionFormProps) {
  const { question } = props;
  const form = useQuestionAnswer(props);
  return (
    <form
      className="user-question-form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.respond();
      }}
    >
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
          toggleOption={form.toggleOption}
        />
        <label htmlFor={`answer-${question.id}`} className="sr-only">
          {question.options.length ? 'Your own answer or additional detail' : 'Your answer'}
        </label>
        <Textarea
          id={`answer-${question.id}`}
          value={form.text}
          disabled={form.disabled}
          maxLength={8000}
          onChange={(event) => form.setText(event.target.value)}
          placeholder={
            question.options.length ? 'Your own answer or extra detail…' : 'Write an answer…'
          }
          rows={1}
        />
        {form.error ? (
          <p className="form-error" role="alert">
            {form.error}
          </p>
        ) : null}
      </div>
      <div className="user-question-actions">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Cancel question"
          disabled={form.disabled}
          onClick={() => void form.respond(true)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="button primary small"
          disabled={form.disabled || !form.canAnswer}
        >
          Answer and continue
        </Button>
      </div>
    </form>
  );
}
