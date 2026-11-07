import type { Snapshot, UserInputRequest } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/types.ts';
export type QuestionFocusIntent = 'text' | 'surface';
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
  /** The expanded question owns the 1–9 option shortcuts. */
  active: boolean;
  /** The owning surface chooses its next focus destination after the question resolves. */
  onResolved?: (id: string, intent?: QuestionFocusIntent) => void;
}
