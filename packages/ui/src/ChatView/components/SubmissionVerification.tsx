import { ManualSubmissionCompletion } from './ManualSubmissionCompletion.tsx';
import { useState } from 'react';
import { SubmissionReceipts } from '@/components/CardDetails/components/SubmissionReceipts.tsx';
import { Button } from '@pitchcrew/design-system/button';
import type { ChatViewModel } from '../types.ts';
import { ClaySubmissionCheck } from './ClaySubmissionCheck.tsx';
import type { SubmissionFollowUpProps } from '../hooks/useSubmissionFollowUp.ts';
export const SubmissionVerification = (
  props: Pick<ChatViewModel, 'thread'> & SubmissionFollowUpProps,
) => {
  const { data, thread, action, working } = props;
  const [later, setLater] = useState<string[]>([]);
  const approval = data.approvals.find((item) => item.submission?.threadId === thread);
  const card = data.cards.find((item) => item.id === approval?.cardId);
  const attempts =
    card?.submissionAttempts?.filter((attempt) => attempt.exportApprovalId === approval?.id) ?? [];
  if (!card || !approval) return null;
  const pending = attempts.find((attempt) => attempt.status === 'uncertain');
  const hidden = pending && later.includes(pending.id);
  const act = (path: string, body?: unknown, success?: string) => {
    void action(path, 'POST', body, success).catch(() => {});
  };
  return (
    <div className="chat-submission-verification">
      {!pending && !attempts.some((attempt) => attempt.status === 'confirmed') ? (
        <ManualSubmissionCompletion
          approval={approval}
          card={card}
          active={
            data.chatRequests?.some(
              (request) =>
                request.id === approval.submission?.requestId &&
                request.deliveries.some((delivery) =>
                  ['queued', 'running', 'waiting'].includes(delivery.status),
                ),
            ) ||
            data.runs.some((run) => run.cardId === card.id && run.status === 'running') ||
            !!card.owner
          }
          action={action}
          working={working}
        />
      ) : null}
      {hidden ? (
        <Button
          variant="outline"
          onClick={() => setLater((ids) => ids.filter((id) => id !== pending.id))}
        >
          Verify submission outcome
        </Button>
      ) : pending ? (
        <ClaySubmissionCheck
          card={card}
          attempt={pending}
          act={act}
          working={working}
          later={() => setLater((ids) => [...ids, pending.id])}
          followUp={props}
        />
      ) : (
        <SubmissionReceipts
          card={{ ...card, submissionAttempts: attempts }}
          act={act}
          working={working}
        />
      )}
    </div>
  );
};
