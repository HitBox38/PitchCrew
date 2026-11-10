import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

type Handler = (id: string) => void;

/**
 * The transcript's handlers as functions that never change but always call the latest ones, so a
 * new closure from the chat view does not render every entry again. They run on clicks only.
 */
export const useStableHandlers = (onOpenCard: Handler, answerQuestion: Handler) => {
  const latest = useRef({ onOpenCard, answerQuestion });
  useLayoutEffect(() => {
    latest.current = { onOpenCard, answerQuestion };
  });
  const open = useCallback((id: string) => latest.current.onOpenCard(id), []);
  const answer = useCallback((id: string) => latest.current.answerQuestion(id), []);
  return useMemo(() => ({ onOpenCard: open, answerQuestion: answer }), [open, answer]);
};
