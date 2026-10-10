import type { Snapshot, UserInputRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
export interface PendingQuestionsProps {
  thread: string;
  reduced: boolean;
  questions: UserInputRequest[];
  data: Snapshot;
  action: Action;
  working: boolean;
  activeQuestionId: string | undefined;
  setActiveQuestionId: (id: string) => void;
}
export interface QuestionFormProps {
  question: UserInputRequest;
  action: Action;
  working: boolean;
}
