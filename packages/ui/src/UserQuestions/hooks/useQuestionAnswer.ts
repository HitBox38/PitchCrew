import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { QuestionFormProps } from '../types.ts';
import { optionShortcut, ownsNumberKeys } from '../helpers.ts';

// Long enough to show the chosen option before the card closes, as in T3 Code.
const answerDelay = 200;

export const useQuestionAnswer = ({ question, action, working, active }: QuestionFormProps) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const respond = async (cancel = false, choice = selected) => {
    clearTimer();
    if (inFlight.current || working) return;
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      await action(
        `/user-input/${question.id}/${cancel ? 'cancel' : 'answer'}`,
        'POST',
        cancel ? {} : { selected: choice, text },
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your answer. Try again.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  const disabled = working || submitting;
  // Multiple choice toggles; a single choice answers at once, with any detail already typed.
  const choose = (id: string) => {
    if (disabled) return;
    if (question.multiSelect) {
      setSelected((current) =>
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
      );
      return;
    }
    setSelected([id]);
    clearTimer();
    timer.current = window.setTimeout(() => void respond(false, [id]), answerDelay);
  };
  const chooseFromKey = useEffectEvent(choose);
  useEffect(() => clearTimer, []);
  useEffect(() => {
    if (!active || disabled || !question.options.length) return;
    const pick = (event: KeyboardEvent) => {
      if (event.defaultPrevented || ownsNumberKeys(event.target)) return;
      const index = optionShortcut(event, question.options.length);
      if (index === null) return;
      event.preventDefault();
      chooseFromKey(question.options[index]!.id);
    };
    document.addEventListener('keydown', pick);
    return () => document.removeEventListener('keydown', pick);
  }, [active, disabled, question.options]);
  return {
    selected,
    text,
    setText,
    error,
    choose,
    respond,
    disabled,
    canAnswer: selected.length > 0 || !!text.trim(),
  };
};
