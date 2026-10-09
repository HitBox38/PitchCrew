import { Link } from '@tanstack/react-router';
import type { Snapshot, UserInputRequest } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { MessageCircleQuestion, Check, X } from 'lucide-react';
export function QuestionMessage({
  question,
  data,
  onAnswer,
}: {
  question: UserInputRequest;
  data: Snapshot;
  onAnswer: (id: string) => void;
}) {
  const continuation = data.chatRequests?.find(
    (request) => request.id === question.continuationRequestId,
  );
  const delivery = continuation?.deliveries[0];
  return (
    <div className="user-question-message" data-status={question.status}>
      <span className="user-question-status">
        {question.status === 'pending' ? (
          <MessageCircleQuestion size={15} />
        ) : question.status === 'answered' ? (
          <Check size={15} />
        ) : (
          <X size={15} />
        )}
        {question.status === 'pending'
          ? 'Waiting for you'
          : question.status === 'answered'
            ? 'Answered'
            : 'Cancelled'}
      </span>
      <p>{question.question}</p>
      {question.reason ? <small>{question.reason}</small> : null}
      {question.status === 'pending' ? (
        <Button
          variant="outline"
          size="sm"
          className="button small"
          onClick={() => onAnswer(question.id)}
        >
          Answer question
        </Button>
      ) : null}
      {question.status === 'cancelled' ? <small>{question.cancellationReason}</small> : null}
      {delivery && ['failed', 'paused'].includes(delivery.status) ? (
        <small>Your answer is saved. Resume this agent’s continuation from the queue.</small>
      ) : null}
      {delivery &&
      ['failed', 'paused'].includes(delivery.status) &&
      continuation.threadId !== question.threadId ? (
        <Button
          variant="outline"
          size="sm"
          className="button small"
          render={<Link to="/chat/$thread" params={{ thread: continuation.threadId }} />}
        >
          View continuation
        </Button>
      ) : null}
    </div>
  );
}
