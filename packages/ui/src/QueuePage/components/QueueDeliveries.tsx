import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { requestDeliveryLabels } from '@/lib/work-queue.ts';

export const QueueDeliveries = ({ request, data }: { request: ChatRequest; data: Snapshot }) => (
  <ul className="queue-deliveries" aria-label="Assigned agents">
    {request.deliveries.map((delivery) => (
      <li key={delivery.roleId} data-status={delivery.status}>
        <RoleAvatar agentRole={delivery.roleId} size="small" />
        <span>
          {data.roles.find((role) => role.id === delivery.roleId)?.name ?? delivery.roleId}
        </span>
        <span className="queue-delivery-status">{requestDeliveryLabels[delivery.status]}</span>
      </li>
    ))}
  </ul>
);
