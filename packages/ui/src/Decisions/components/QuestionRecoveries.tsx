import type { Snapshot } from '@pitchcrew/core';
import { useQuestionLifecycle } from '@/UserQuestions/hooks/useQuestionLifecycle.ts';
import { QuestionResponseRecoveries } from '@/UserQuestions/components/QuestionResponseRecoveries.tsx';

/** Reconcile question drafts before the owning Decisions focus manager selects its target. */
export const QuestionRecoveries = ({ questions }: { questions: Snapshot['userInputs'] }) => {
  useQuestionLifecycle(questions);
  return <QuestionResponseRecoveries />;
};
