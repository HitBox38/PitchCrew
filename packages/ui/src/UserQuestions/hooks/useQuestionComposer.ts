import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { focusQuestionAnswer } from '../focus.ts';

/** Preserve an active editing session; only a genuine question arrival hands typing to its field. */
export const useQuestionComposer = (
  ref: RefObject<HTMLElement | null>,
  answering: boolean,
  questionId: string | undefined,
  draft = '',
  thread = '',
  attachments = 0,
) => {
  const [hidden, setHidden] = useState(false);
  const owner = questionId ? `${thread}:${questionId}` : undefined;
  const hasDraft = !!draft.trim() || attachments > 0;
  const previous = useRef({ owner, hasDraft });
  const latched = useRef<string | undefined>(undefined);
  const editing = useRef(false);
  useLayoutEffect(() => {
    const track = () => {
      editing.current = !!ref.current?.contains(document.activeElement);
    };
    track();
    document.addEventListener('focusin', track);
    return () => document.removeEventListener('focusin', track);
  }, [ref, thread]);
  useLayoutEffect(() => {
    const element = ref.current;
    const focused = () => !!element?.contains(document.activeElement);
    if (previous.current.owner !== owner) latched.current = undefined;
    else if (
      (focused() || (editing.current && document.activeElement === document.body)) &&
      previous.current.hasDraft &&
      !hasDraft
    ) {
      latched.current = owner;
      if (document.activeElement === document.body) element?.focus();
    }
    previous.current = { owner, hasDraft };
    let frame: number | undefined;
    let attempts = 0;
    const settle = () => {
      if (!answering) {
        setHidden(false);
        return;
      }
      if (owner && latched.current === owner) {
        setHidden(false);
        return;
      }
      if (focused() && !focusQuestionAnswer(questionId)) {
        // A collapsible may finish opening in the next commit. Keep the caret safe until then.
        setHidden(false);
        if (++attempts < 3) frame = requestAnimationFrame(settle);
        return;
      }
      setHidden(true);
    };
    settle();
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [ref, answering, questionId, owner, hasDraft]);
  return hidden;
};
