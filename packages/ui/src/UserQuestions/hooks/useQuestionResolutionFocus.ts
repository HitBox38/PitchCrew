import { useLayoutEffect, useRef } from 'react';
import { questionOwnsFocus } from '../focus.ts';
import type { QuestionFocusIntent } from '../types.ts';

/** Resolution can arrive through polling, a different surface, or a delayed GET reconciliation. */
export const useQuestionResolutionFocus = (
  questions: readonly { id: string }[],
  onResolved: ((id: string, intent?: QuestionFocusIntent) => void) | undefined,
) => {
  const previous = useRef<{ path: string; ids: Set<string> } | undefined>(undefined);
  const owned = useRef<string | undefined>(undefined);
  const intent = useRef<QuestionFocusIntent>('text');
  useLayoutEffect(() => {
    const track = () => {
      const form = document.activeElement?.closest('form');
      intent.current = document.activeElement?.matches('[data-question-choice-target]')
        ? 'surface'
        : 'text';
      owned.current = form
        ?.querySelector<HTMLElement>('[data-question-answer-target]')
        ?.id.replace(/^answer-/, '');
    };
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, []);
  useLayoutEffect(() => {
    const path = window.location.pathname;
    const ids = new Set(questions.map((question) => question.id));
    const id = owned.current;
    if (previous.current?.path !== path) owned.current = undefined;
    else if (id && previous.current.ids.has(id) && !ids.has(id)) {
      const form = document.getElementById(`answer-${id}`)?.closest('form') ?? null;
      if (document.activeElement === document.body || questionOwnsFocus(form))
        onResolved?.(id, intent.current);
      owned.current = undefined;
    }
    previous.current = { path, ids };
  }, [questions, onResolved]);
};
