import { Button } from '@pitchcrew/design-system/button';
import type { useQuestionAnswer } from '../hooks/useQuestionAnswer.ts';

export const QuestionAnswerFeedback = ({
  id,
  form,
}: {
  id: string;
  form: ReturnType<typeof useQuestionAnswer>;
}) => (
  <>
    {form.error ? (
      <p id={`answer-error-${id}`} className="form-error" role="alert">
        {form.error}
      </p>
    ) : null}
    {form.notice ? (
      <output id={`answer-status-${id}`} className="user-question-status-note">
        {form.notice}
      </output>
    ) : null}
    {form.needsStatusCheck ? (
      <Button
        className="question-status-check"
        variant="ghost"
        size="sm"
        aria-disabled={form.submitting || undefined}
        onClick={() => {
          if (!form.submitting) void form.checkStatus();
        }}
      >
        {form.submitting ? 'Checking question status…' : 'Check question status'}
      </Button>
    ) : null}
  </>
);
