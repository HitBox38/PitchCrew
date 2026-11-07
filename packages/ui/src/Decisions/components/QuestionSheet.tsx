import { Link } from '@tanstack/react-router';
import type { Card, Snapshot, UserInputRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { Button } from '@pitchcrew/design-system/button';
import { QuestionAnswerFields } from '@/UserQuestions/components/QuestionAnswerFields.tsx';
import { useQuestionAnswer } from '@/UserQuestions/hooks/useQuestionAnswer.ts';
import type { Decision } from '@/ClayInterface/signals.ts';
import { DecisionHeading } from './DecisionHeading.tsx';
import { DecisionRail } from './DecisionRail.tsx';

type QuestionSheetProps = {
  decision: Decision;
  question: UserInputRequest;
  card: Card | undefined;
  data: Snapshot;
  action: Action;
  working: boolean;
  openCard: (id: string, section?: 'application') => void;
  onResolved?: () => void;
};

/** A question in the decision sheet; its answer and cancel buttons sit in the pinned footer. */
export const QuestionSheet = (props: QuestionSheetProps) => {
  const { decision, question, card, data } = props;
  const form = useQuestionAnswer({ ...props, active: true });
  const formId = `decision-question-${question.id}`;
  return (
    <article
      className="decide-sheet"
      data-kind="question"
      data-decision-id={decision.id}
      aria-label="Decision"
    >
      <div className="decide-sheet-scroll">
        <div className="decide-main">
          <DecisionHeading {...props} />
          <form
            id={formId}
            className="user-question-form decide-question"
            aria-labelledby={`question-title-${question.id}`}
            aria-busy={form.submitting}
            onSubmit={(event) => {
              event.preventDefault();
              void form.respond();
            }}
          >
            <QuestionAnswerFields question={question} form={form} />
          </form>
        </div>
        <DecisionRail decision={decision} data={data} card={card} packet={undefined} />
      </div>
      <footer className="decide-footer" aria-label="Question">
        <div className="decide-footer-bar">
          <div className="decide-actions">
            <Button type="submit" form={formId} disabled={form.disabled || !form.canAnswer}>
              Answer and continue
            </Button>
            <Button
              variant="outline"
              aria-label="Cancel question"
              form={formId}
              disabled={form.disabled}
              onClick={() => void form.respond(true)}
            >
              Cancel question
            </Button>
          </div>
          <div className="decide-footer-aside">
            {decision.threadId ? (
              <Link
                className="decide-link"
                to="/chat/$thread"
                params={{ thread: decision.threadId }}
              >
                Open the conversation
              </Link>
            ) : null}
            <p className="decide-consequence">Answering continues only the agent that asked.</p>
          </div>
        </div>
      </footer>
    </article>
  );
};
