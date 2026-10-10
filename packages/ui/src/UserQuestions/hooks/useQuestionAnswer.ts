import { useRef, useState } from 'react';
import type { QuestionFormProps } from '../types.ts';
export function useQuestionAnswer({ question, action, working }: QuestionFormProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const toggleOption = (id: string) =>
    setSelected((current) =>
      question.multiSelect
        ? current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id]
        : current.includes(id)
          ? []
          : [id],
    );
  const respond = async (cancel = false) => {
    if (inFlight.current || working) return;
    inFlight.current = true;
    setSubmitting(true);
    setError('');
    try {
      await action(
        `/user-input/${question.id}/${cancel ? 'cancel' : 'answer'}`,
        'POST',
        cancel ? {} : { selected, text },
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save your answer. Try again.');
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };
  return {
    selected,
    text,
    setText,
    error,
    toggleOption,
    respond,
    disabled: working || submitting,
    canAnswer: selected.length > 0 || !!text.trim(),
  };
}
