import { Eye, Mail } from 'lucide-react';
import type { Card, SubmissionAttempt } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import {
  useSubmissionFollowUp,
  type SubmissionFollowUpProps,
} from '../hooks/useSubmissionFollowUp.ts';

/**
 * Ways to find out what happened. Show the page opens the submitting agent's
 * browser here; asking the Gmail tracker prefills a draft in a conversation with it, never sent.
 */
export const ClaySubmissionFollowUp = ({
  card,
  attempt,
  ...props
}: SubmissionFollowUpProps & { card: Card; attempt: SubmissionAttempt }) => {
  const { tracker, canLook, look, askTracker, busy } = useSubmissionFollowUp(props, card, attempt);
  if (!canLook && !tracker) return null;
  return (
    <div className="clay-submission-follow-up">
      {canLook ? (
        <Button
          size="sm"
          variant="ghost"
          title="Opens the browser beside this chat. Control stays locked until you record the outcome."
          onClick={look}
        >
          <Eye size={14} aria-hidden="true" />
          Show the page
        </Button>
      ) : null}
      {tracker ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || props.working}
          title={`Writes a message for ${tracker.name} that you can edit and send.`}
          onClick={() => void askTracker()}
        >
          <Mail size={14} aria-hidden="true" />
          Ask {tracker.name} to check Gmail
        </Button>
      ) : null}
    </div>
  );
};
