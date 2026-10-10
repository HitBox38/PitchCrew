import type { ChatRequest, Snapshot } from '@pitchcrew/core';
export function RequestDeliveryStatus({ request, data }: { request: ChatRequest; data: Snapshot }) {
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
          <span
            key={delivery.roleId}
            title={delivery.error || (label ? `Working in ${label}` : '')}
          >
            {data.roles.find((agent) => agent.id === delivery.roleId)?.name ?? delivery.roleId}:{' '}
            {delivery.status === 'queued'
              ? label
                ? `waiting · ${label}`
                : 'waiting'
              : delivery.status === 'running'
                ? 'working'
                : delivery.status === 'completed'
                  ? 'finished'
                  : delivery.status}
            {delivery.error ? ` · ${delivery.error}` : ''}
          </span>
        );
      })}
    </div>
  );
}
