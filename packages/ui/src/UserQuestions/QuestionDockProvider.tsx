import { createContext, useContext, type ReactNode } from 'react';
import { activeQuestion } from './helpers.ts';
import { useQuestionToastVisibility } from './hooks/useQuestionToastVisibility.ts';
import { useQuestionResolutionFocus } from './hooks/useQuestionResolutionFocus.ts';
import type { QuestionFocusIntent } from './types.ts';

type QuestionDock = {
  ids: ReadonlySet<string>;
  activeId: string | undefined;
  writeMessage: () => void;
};
const QuestionDockContext = createContext<QuestionDock | null>(null);

/** Transcript records and the answer dock share the same controlled expansion state. */
export const QuestionDockProvider = ({
  questions,
  activeQuestionId,
  onWriteMessage,
  onQuestionResolved,
  children,
}: {
  questions: readonly { id: string; messageId?: string; threadId?: string }[];
  activeQuestionId: string | undefined;
  onWriteMessage: () => void;
  onQuestionResolved?: (id: string, intent?: QuestionFocusIntent) => void;
  children: ReactNode;
}) => {
  const activeId = activeQuestion(questions, activeQuestionId);
  useQuestionResolutionFocus(questions, onQuestionResolved);
  useQuestionToastVisibility(questions.find((question) => question.id === activeId));
  return (
    <QuestionDockContext
      value={{
        ids: new Set(questions.map((question) => question.id)),
        activeId,
        writeMessage: onWriteMessage,
      }}
    >
      {children}
    </QuestionDockContext>
  );
};

/** Reveal the same preserved composer from question and historical failure controls. */
export const useWriteMessage = () => useContext(QuestionDockContext)?.writeMessage;
export const useOpenQuestionId = () => useContext(QuestionDockContext)?.activeId;

export const useQuestionDock = (id: string) => {
  const dock = useContext(QuestionDockContext);
  return { present: dock?.ids.has(id) ?? false, open: dock?.activeId === id };
};
