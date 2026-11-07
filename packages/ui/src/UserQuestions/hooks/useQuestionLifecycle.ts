import { useLayoutEffect } from 'react';
import type { UserInputRequest } from '@pitchcrew/core';
import { reconcileQuestions } from '../question-state.ts';

/** Route changes never prune drafts; confirmed answer/cancel status does. */
export const useQuestionLifecycle = (questions: readonly UserInputRequest[] | undefined) => {
  useLayoutEffect(() => {
    if (questions) reconcileQuestions(questions);
  }, [questions]);
};
