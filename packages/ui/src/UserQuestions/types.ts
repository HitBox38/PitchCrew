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
  /**
   * Home's desk: a choice, clicked or keyed, only selects; typed detail keeps it; nothing is sent
   * until the form is submitted (Answer and continue). The 1–9 keys then act only while focus is
   * inside this form. Chat and job details leave it off: there a single choice answers at once.
   */
  answerOnSubmit?: boolean;
  /**
   * Home's desk: Answer and continue leads the actions at the left, as each desk row's glazed verb
   * does, with Cancel question after it. Chat and job details keep Cancel at the left.
   */
  answerFirst?: boolean;
  /** The owning surface chooses its next focus destination after the question resolves. */
  onResolved?: (id: string, intent?: QuestionFocusIntent) => void;
}
