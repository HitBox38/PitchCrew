import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  dismissQuestionRecovery,
  useQuestionState,
  type QuestionRecovery,
} from '../question-state.ts';
import { focusAfterReveal, questionReturnFocus } from '../focus.ts';

const Recovery = ({ response }: { response: QuestionRecovery }) => {
  const [copied, setCopied] = useState(false);
  const content = [...response.selected, response.text].filter(Boolean).join('\n');
  return (
    <section
      id={`question-response-recovery-${response.id}`}
      className="question-response-recovery"
      data-shortcut-scope="input"
      tabIndex={-1}
      aria-labelledby={`question-recovery-title-${response.id}`}
    >
      <strong id={`question-recovery-title-${response.id}`}>
        This question was {response.status} elsewhere. Your unsent response is kept.
      </strong>
      <p>{response.question}</p>
      <blockquote
        aria-label="Kept response"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users can scroll a long retained response before copying it.
        tabIndex={0}
      >
        {content}
      </blockquote>
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void navigator.clipboard
              .writeText(content)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copied' : 'Copy response'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(event) => {
            const decisions = event.currentTarget.closest('.decide');
            dismissQuestionRecovery(response.id);
            focusAfterReveal(
              () =>
                decisions?.querySelector<HTMLElement>(
                  '.question-response-recovery, [data-decision-focus]',
                ) ??
                document.querySelector<HTMLElement>('.question-response-recovery') ??
                questionReturnFocus(),
            );
          }}
        >
          Discard response
        </Button>
      </div>
    </section>
  );
};

/** An external answer/cancellation never silently discards a different local response. */
export const QuestionResponseRecoveries = ({ thread }: { thread?: string }) => {
  const responses = useQuestionState((state) => state.recoveries);
  return Object.values(responses)
    .filter((response) => !thread || response.threadId === thread)
    .map((response) => <Recovery key={response.id} response={response} />);
};
