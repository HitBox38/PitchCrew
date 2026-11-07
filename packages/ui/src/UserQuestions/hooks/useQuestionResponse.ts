import type { QuestionFocusIntent, QuestionFormProps } from '../types.ts';
import { focusQuestionAnswer, focusQuestionSurface, questionOwnsFocus } from '../focus.ts';
import { ActionRefreshError } from '@/WorkspaceStore/action-errors.ts';
import { ApiHttpError } from '@/api-errors.ts';
import {
  beginQuestion,
  emptyQuestionDraft,
  reconcileQuestions,
  updateQuestion,
  useQuestionState,
  sameQuestionAnswer,
} from '../question-state.ts';
import { questionRecord, questionStatus, refreshQuestionStatus } from '../reconcile-response.ts';

type Props = Pick<QuestionFormProps, 'question' | 'action' | 'onResolved'> & {
  selected: string[];
  text: string;
};
/** One shared request lock per question survives navigation; unrelated actions never lock it. */
export const useQuestionResponse = ({ question, action, selected, text, onResolved }: Props) => {
  const state = useQuestionState((current) => current.drafts[question.id] ?? emptyQuestionDraft);
  const focusContext = (intent: QuestionFocusIntent = 'text') => {
    const pathname = window.location.pathname;
    const form = document.getElementById(`answer-${question.id}`)?.closest('form') ?? null;
    const owned =
      questionOwnsFocus(form) || (intent === 'surface' && document.activeElement === document.body);
    const focus = () =>
      intent === 'surface' ? focusQuestionSurface(question.id) : focusQuestionAnswer(question.id);
    if (owned) focus();
    return {
      pathname,
      intent,
      focus,
      owns: () =>
        owned &&
        (document.activeElement === document.body ||
          questionOwnsFocus(form) ||
          questionOwnsFocus(
            document.getElementById(`answer-${question.id}`)?.closest('form') ?? null,
          )),
    };
  };
  const finishFocus = (saved: boolean, context: ReturnType<typeof focusContext>) => {
    if (window.location.pathname !== context.pathname || !context.owns()) return;
    if (saved) onResolved?.(question.id, context.intent);
    else
      requestAnimationFrame(() => {
        if (window.location.pathname === context.pathname && context.owns()) context.focus();
      });
  };
  const settle = async (
    token: symbol,
    accepted: boolean,
    cancel: boolean,
    refresh: boolean,
    context: ReturnType<typeof focusContext>,
    failure?: unknown,
    recheck = false,
  ) => {
    const status = refresh ? await refreshQuestionStatus(question.id) : questionStatus(question.id);
    if (status && status !== 'pending') {
      if (accepted) updateQuestion(question.id, token, { accepted: true });
      reconcileQuestions([questionRecord(question.id) ?? { id: question.id, status }]);
      finishFocus(true, context);
      return;
    }
    const rejection =
      failure instanceof ApiHttpError && failure.status >= 400 && failure.status < 500
        ? failure.message
        : useQuestionState.getState().drafts[question.id]?.httpRejection;
    if (status === 'pending' && !accepted) {
      const submitted = useQuestionState.getState().drafts[question.id]?.submitted;
      updateQuestion(question.id, token, {
        phase: 'idle',
        accepted: false,
        notice: undefined,
        rejected: rejection && !cancel ? submitted : undefined,
        error: rejection
          ? rejection
          : cancel
            ? 'Could not cancel this question. It is still waiting; your response is kept.'
            : "Your answer wasn't saved. It's still here, so you can try again.",
      });
    } else {
      updateQuestion(question.id, token, {
        phase: 'uncertain',
        accepted,
        error: '',
        notice: [
          rejection,
          accepted
            ? `${cancel ? 'Cancellation' : 'Answer'} accepted. ${recheck ? "Still can't refresh this question." : ''} Check status to refresh this question.`
            : `${recheck ? "Still can't confirm" : 'Could not confirm'} whether ${cancel ? 'this question was cancelled' : 'your answer was saved'}. Your response is kept. Check status before retrying.`,
        ]
          .filter(Boolean)
          .join(' '),
      });
    }
    finishFocus(false, context);
  };
  const respond = async (
    cancel = false,
    choice = selected,
    intent: QuestionFocusIntent = 'text',
  ) => {
    if ((useQuestionState.getState().drafts[question.id]?.phase ?? 'idle') !== 'idle') return;
    const context = focusContext(intent);
    const token = beginQuestion(question.id, question.threadId, cancel, { text, selected: choice });
    if (!token) return;
    try {
      await action(
        `/user-input/${question.id}/${cancel ? 'cancel' : 'answer'}`,
        'POST',
        cancel ? {} : { selected: choice, text },
        undefined,
        { errorToast: false },
      );
      await settle(
        token,
        true,
        cancel,
        !questionStatus(question.id) || questionStatus(question.id) === 'pending',
        context,
      );
    } catch (error) {
      const accepted = error instanceof ActionRefreshError;
      updateQuestion(question.id, token, {
        phase: 'checking',
        accepted,
        httpRejection:
          error instanceof ApiHttpError && error.status >= 400 && error.status < 500
            ? error.message
            : undefined,
      });
      await settle(token, accepted, cancel, true, context, error);
    }
  };
  const checkStatus = async () => {
    const current = useQuestionState.getState().drafts[question.id];
    if (current?.phase !== 'uncertain' || !current.token) return;
    const context = focusContext('surface');
    updateQuestion(question.id, current.token, {
      phase: 'checking',
      notice: 'Checking question status…',
    });
    await settle(
      current.token,
      !!current.accepted,
      !!current.cancel,
      true,
      context,
      undefined,
      true,
    );
  };
  return {
    error: state.error,
    notice: state.notice,
    submitting: state.phase === 'sending' || state.phase === 'checking',
    disabled: state.phase !== 'idle',
    needsStatusCheck: state.phase === 'uncertain' || state.phase === 'checking',
    rejectedSameAnswer: sameQuestionAnswer(state.rejected, { selected, text }),
    respond,
    checkStatus,
  };
};
