import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { reconcileQuestions } from './question-state.ts';

/** Reads only; an ambiguous or accepted response is never submitted again automatically. */
export const questionRecord = (id: string) =>
  useWorkspaceStore.getState().data?.userInputs?.find((question) => question.id === id);
export const questionStatus = (id: string) => questionRecord(id)?.status;
export const refreshQuestionStatus = async (id: string) => {
  try {
    await useWorkspaceStore.getState().reload();
    const questions = useWorkspaceStore.getState().data?.userInputs;
    if (questions) reconcileQuestions(questions);
    return questionStatus(id);
  } catch {
    return undefined;
  }
};
