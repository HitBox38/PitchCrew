import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import type { QuestionFocusIntent, QuestionFormProps } from '../types.ts';
import { optionShortcut, ownsNumberKeys } from '../helpers.ts';
import { useQuestionResponse } from './useQuestionResponse.ts';
import { questionShortcutTarget } from '../focus.ts';
import { editQuestion, emptyQuestionDraft, useQuestionState } from '../question-state.ts';

// Long enough to show the chosen option before the card closes, as in T3 Code.
const answerDelay = 200;

export const useQuestionAnswer = ({ question, action, active, onResolved }: QuestionFormProps) => {
  const draft = useQuestionState((state) => state.drafts[question.id] ?? emptyQuestionDraft);
  const selected = draft.selected,
    text = draft.text;
  const setText = (value: string) => {
    clearTimer();
    editQuestion(question.id, question.threadId, {
      text: value,
      ...(!question.multiSelect ? { selected: [] } : {}),
    });
  };
  const setSelected = (value: string[] | ((current: string[]) => string[])) =>
    editQuestion(question.id, question.threadId, {
      selected:
        typeof value === 'function'
          ? value(useQuestionState.getState().drafts[question.id]?.selected ?? [])
          : value,
    });
  const response = useQuestionResponse({ question, action, selected, text, onResolved });
  const timer = useRef<number | null>(null);
  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const respond = async (
    cancel = false,
    choice = selected,
    intent: QuestionFocusIntent = 'text',
  ) => {
    clearTimer();
    await response.respond(cancel, choice, intent);
  };
  const latestResponse = useRef(respond);
  useLayoutEffect(() => {
    latestResponse.current = respond;
  });
  const disabled = response.disabled;
  // Multiple choice toggles; a single choice answers at once, with any detail already typed.
  const choose = (id: string, shortcut = false) => {
    if (disabled) return;
    if (question.multiSelect) {
      setSelected((current) =>
        current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
      );
      return;
    }
    clearTimer();
    if (!shortcut && selected.includes(id)) {
      setSelected([]);
      return;
    }
    setSelected([id]);
    timer.current = window.setTimeout(
      () => void latestResponse.current(false, [id], 'surface'),
      answerDelay,
    );
  };
  const chooseFromKey = useEffectEvent(choose);
  useEffect(() => clearTimer, []);
  useEffect(() => {
    if (!active || disabled || !question.options.length) return;
    const pick = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        ownsNumberKeys(event.target) ||
        !questionShortcutTarget(question.id, event.target)
      )
        return;
      const index = optionShortcut(event, question.options.length);
      if (index === null) return;
      event.preventDefault();
      chooseFromKey(question.options[index]!.id, true);
    };
    document.addEventListener('keydown', pick);
    return () => document.removeEventListener('keydown', pick);
  }, [active, disabled, question.id, question.options]);
  return {
    selected,
    text,
    setText,
    error: response.error,
    notice: response.notice,
    needsStatusCheck: response.needsStatusCheck,
    checkStatus: response.checkStatus,
    submitting: response.submitting,
    choose,
    respond,
    disabled,
    canAnswer: (selected.length > 0 || !!text.trim()) && !response.rejectedSameAnswer,
  };
};
