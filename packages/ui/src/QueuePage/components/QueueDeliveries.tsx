import type { ChatRequest, Snapshot } from '@pitchcrew/core';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { requestDeliveryLabels } from '@/lib/work-queue.ts';

/** Each recipient's pebble, name and delivery state, with a bead carrying that state. */
export const QueueDeliveries = ({ request, data }: { request: ChatRequest; data: Snapshot }) => (
  <ul className="queue-deliveries" aria-label="Assigned agents">
    {request.deliveries.map((delivery) => (
      <li key={delivery.roleId} data-status={delivery.status}>
        <RoleAvatar agentRole={delivery.roleId} size="small" />
        <span>
          {data.roles.find((role) => role.id === delivery.roleId)?.name ?? delivery.roleId}
        </span>
        <StatusBead status={delivery.status} />
        <span className="queue-delivery-status">{requestDeliveryLabels[delivery.status]}</span>
      </li>
    ))}
  </ul>
);
