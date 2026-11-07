import {
  collapseQuestions,
  emptyQuestionSelection,
  pendingQuestionId,
  selectQuestion,
  useQuestionState,
} from '../question-state.ts';

export const useQuestionSelection = (thread: string, questions: readonly { id: string }[]) => {
  const selection = useQuestionState((state) => state.docks[thread] ?? emptyQuestionSelection);
  const activeQuestionId =
    pendingQuestionId(questions, selection) ?? (questions.length ? '' : undefined);
  const setActiveQuestionId = (id: string) => {
    if (id) selectQuestion(thread, id);
    else if (activeQuestionId)
      collapseQuestions(
        thread,
        questions.map((question) => question.id),
      );
  };
  return { activeQuestionId, setActiveQuestionId };
};
