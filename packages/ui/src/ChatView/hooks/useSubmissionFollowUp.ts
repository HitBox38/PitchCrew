import { useState } from 'react';
import type { Card, Conversation, SubmissionAttempt } from '@pitchcrew/core';
import type { ChatViewModel } from '../types.ts';
import { gmailTracker, trackerConversation, trackerDraft } from '../submission-follow-up.ts';

export type SubmissionFollowUpProps = Pick<
  ChatViewModel,
  | 'data'
  | 'conversation'
  | 'browserPanel'
  | 'action'
  | 'working'
  | 'onThread'
  | 'setDrafts'
  | 'applyStarter'
  | 'setPane'
  | 'readOnly'
  | 'inputRef'
>;

/**
 * Follow-ups for an uncertain submission. Looking only opens this conversation's
 * browser panel on the submitting agent: the daemon refuses private control and manual input
 * while the outcome is unresolved. Asking the Gmail tracker only prefills a draft the user sends.
 */
export const useSubmissionFollowUp = (
  props: SubmissionFollowUpProps,
  card: Card,
  attempt: SubmissionAttempt,
) => {
  const { browserPanel, conversation, data } = props;
  const [busy, setBusy] = useState(false);
  const tracker = props.readOnly ? undefined : gmailTracker(data);
  const canLook =
    !props.readOnly &&
    browserPanel.available &&
    browserPanel.roles.some((role) => role.id === attempt.roleId);
  const look = () => {
    browserPanel.show();
    browserPanel.select(attempt.roleId);
  };
  const askTracker = async () => {
    if (!tracker || busy) return;
    const target = trackerConversation(data.conversations, conversation, card, tracker.id);
    if (target.kind === 'current') {
      props.setPane('conversation');
      props.applyStarter(trackerDraft(card, tracker.id, conversation?.participants ?? []));
      return;
    }
    setBusy(true);
    try {
      const thread =
        target.kind === 'existing'
          ? target
          : ((await props.action('/conversations', 'POST', {
              title: `${card.company}: Submission check`.slice(0, 120),
              participants: [tracker.id],
              cardId: card.id,
            })) as Conversation);
      const draft = trackerDraft(card, tracker.id, thread.participants);
      props.setDrafts((current) => ({ ...current, [thread.id]: draft }));
      props.onThread(thread.id);
      requestAnimationFrame(() => props.inputRef.current?.focus());
    } catch {
      /* The workspace action reports the failure. */
    } finally {
      setBusy(false);
    }
  };
  return { tracker, canLook, look, askTracker, busy };
};
