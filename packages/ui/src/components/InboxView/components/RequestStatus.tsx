import type { Snapshot } from '@pitchcrew/core';
import { historyTone } from '../helpers.ts';
import { requestStatus } from '../status.ts';
import type { ApprovalRequest } from '../types.ts';

/** Where a packet or browser request stands, coloured by how it moved on. */
export const RequestStatus = ({ request, data }: { request: ApprovalRequest; data: Snapshot }) => (
  <span className="decision-status" data-tone={historyTone(request, data)}>
    {requestStatus(request, data)}
  </span>
);
