import { Button } from '@/components/ui/button/components/Button.tsx';
import { QuestionAnswerFields } from './QuestionAnswerFields.tsx';
import { useQuestionAnswer } from '../hooks/useQuestionAnswer.ts';
import type { QuestionFormProps } from '../types.ts';

export const QuestionAnswerForm = (props: QuestionFormProps) => {
  const form = useQuestionAnswer(props);
  return (
    <form
      className="user-question-form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.respond();
      }}
    >
      <QuestionAnswerFields question={props.question} form={form} />
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
};
