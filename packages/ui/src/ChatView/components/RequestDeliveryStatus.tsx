import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import { QueueDiagnostics } from './QueueDiagnostics.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
export const RequestDeliveryStatus = ({
  request,
  data,
}: {
  request: ChatRequest;
  data: Snapshot;
}) => {
  return (
    <div className="chat-deliveries">
      {request.deliveries.map((delivery) => {
        const occupying = data.runs.find(
          (run) =>
            run.roleId === delivery.roleId &&
            run.status === 'running' &&
            run.threadId !== request.threadId,
        );
        const label = occupying
          ? (data.conversations?.find((item) => item.id === occupying.threadId)?.title ??
            'another conversation')
          : null;
        return (
          <span key={delivery.roleId} title={label ? `Working in ${label}` : undefined}>
            <StatusBead status={delivery.status} />
            {data.roles.find((agent) => agent.id === delivery.roleId)?.name ??
              delivery.roleId}:{' '}
            {delivery.status === 'queued'
              ? label
                ? `waiting · ${label}`
                : 'waiting'
              : delivery.status === 'running'
                ? 'working'
                : delivery.status === 'completed'
                  ? 'finished'
                  : delivery.status === 'failed'
                    ? 'reply failed'
                    : delivery.status === 'paused'
                      ? delivery.runId
                        ? 'reply stopped'
                        : 'not sent'
                      : delivery.status === 'cancelled'
                        ? 'cancelled'
                        : 'waiting for your answer'}
          </span>
        );
      })}
      <QueueDiagnostics
        entries={request.deliveries.flatMap((delivery) => {
          const run = data.runs.find((item) => item.id === delivery.runId);
          const text = delivery.error || (run?.status === 'failed' ? run.message : '');
          return text
            ? [
                {
                  label:
                    data.roles.find((role) => role.id === delivery.roleId)?.name ?? delivery.roleId,
                  text,
                },
              ]
            : [];
        })}
      />
    </div>
  );
};
