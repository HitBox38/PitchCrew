import { deliveryLifecycle } from '@pitchcrew/core/lifecycles';
import { Link } from '@tanstack/react-router';
import type { Snapshot, UserInputRequest } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { useQuestionDock } from '../QuestionDockProvider.tsx';

const beads = { pending: 'waiting', answered: 'completed', cancelled: 'cancelled' } as const;
export const QuestionMessage = ({
  question,
  data,
  onAnswer,
}: {
  question: UserInputRequest;
  data: Snapshot;
  onAnswer: (id: string) => void;
}) => {
  const dock = useQuestionDock(question.id);
  if (question.status === 'pending' && dock.open) return null;
  if (question.status === 'pending' && dock.present) {
    const name = data.roles.find((role) => role.id === question.roleId)?.name ?? question.roleId;
    return (
      <div className="user-question-record">
        <StatusBead status="waiting" />
        <p title={question.question}>
          <strong>{name} asked:</strong> {question.question}
        </p>
        {!dock.open ? (
          <Button variant="ghost" size="sm" onClick={() => onAnswer(question.id)}>
            Answer question
          </Button>
        ) : null}
      </div>
    );
  }
  const continuation = data.chatRequests?.find(
    (request) => request.id === question.continuationRequestId,
  );
  const delivery = continuation?.deliveries[0];
  return (
    <div className="user-question-message" data-status={question.status}>
      <span className="user-question-status">
        <StatusBead status={beads[question.status]} />
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
      {delivery && deliveryLifecycle.is('stopped', delivery.status) ? (
        <small className="user-question-resume">
          <StatusBead status={delivery.status} />
          Your answer is saved. Resume this agent’s continuation from the queue.
        </small>
      ) : null}
      {delivery &&
      deliveryLifecycle.is('stopped', delivery.status) &&
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
};
