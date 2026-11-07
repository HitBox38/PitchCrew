import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { focusAfterReveal } from '@/UserQuestions/focus.ts';

/** The Decisions surface owns the next sheet or its existing empty-state message. */
export const useDecisionResolutionFocus = (
  root: RefObject<HTMLElement | null>,
  resolvedId?: string,
) => {
  const previous = useRef<{ id?: string; path: string } | undefined>(undefined);
  const owned = useRef<string | undefined>(undefined);
  const focusNext = useCallback(
    (skip = resolvedId) =>
      focusAfterReveal(() => {
        const recovery = skip
          ? root.current?.querySelector<HTMLElement>(`#question-response-recovery-${skip}`)
          : null;
        if (recovery) return recovery;
        const target = root.current?.querySelector<HTMLElement>('[data-decision-focus]');
        return skip &&
          target?.closest<HTMLElement>('[data-decision-id]')?.dataset.decisionId === skip
          ? null
          : target;
      }),
    [root, resolvedId],
  );
  useLayoutEffect(() => {
    const track = () => {
      const active = document.activeElement;
      owned.current =
        active && root.current?.contains(active)
          ? active.closest<HTMLElement>('[data-decision-id]')?.dataset.decisionId
          : undefined;
    };
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, [root]);
  useLayoutEffect(() => {
    const path = window.location.pathname,
      old = previous.current;
    if (
      old?.path === path &&
      old.id &&
      old.id !== resolvedId &&
      owned.current === old.id &&
      document.activeElement === document.body
    )
      focusNext(old.id);
    if (old?.path !== path || old?.id !== resolvedId) owned.current = undefined;
    previous.current = { id: resolvedId, path };
  }, [resolvedId, focusNext]);
  return () => focusNext();
};
