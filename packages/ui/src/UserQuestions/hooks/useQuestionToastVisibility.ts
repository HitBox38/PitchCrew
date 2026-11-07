import { useLayoutEffect, useState } from 'react';
import { clearVisibleQuestionToast, setVisibleQuestionToast } from '../toast-visibility.ts';

/** Publish before notification effects run, including when the question arrives with a snapshot. */
export const useQuestionToastVisibility = (
  question: { id: string; messageId?: string; threadId?: string } | undefined,
) => {
  const [owner] = useState(() => Symbol('question-dock'));
  const messageId = question?.messageId,
    threadId = question?.threadId,
    questionId = question?.id;
  useLayoutEffect(() => {
    let frame = 0;
    const publish = () => {
      let inConversation = false;
      try {
        inConversation = decodeURIComponent(window.location.pathname) === `/chat/${threadId}`;
      } catch {
        /* Invalid routes show no dock. */
      }
      const answer = document.getElementById(`answer-${questionId}`);
      const shown =
        !!answer?.getClientRects().length &&
        !answer.closest('[hidden], [inert], [aria-hidden="true"]');
      setVisibleQuestionToast(
        owner,
        inConversation && shown && document.visibilityState === 'visible' ? messageId : undefined,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(publish);
    };
    publish();
    document.addEventListener('visibilitychange', publish);
    window.addEventListener('popstate', publish);
    // Opening content can mount after this effect; modal inertness can also change independently.
    const observer = new MutationObserver(schedule);
    if (questionId)
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'inert', 'aria-hidden', 'data-open'],
      });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', publish);
      window.removeEventListener('popstate', publish);
      clearVisibleQuestionToast(owner);
    };
  }, [owner, messageId, threadId, questionId]);
};
