import type { ComputerApproval } from '@pitchcrew/core';
import { approvalParts } from '@/ComputerApprovals/helpers.ts';

/**
 * The request's title in parts: when space runs out the value shortens (middle first, then an
 * ellipsis) while the verb and the target always stay readable.
 */
export const BrowserApprovalTitle = ({
  approval,
  summary,
}: {
  approval: ComputerApproval;
  summary: string;
}) => {
  const parts = approvalParts(approval.action, approval.page);
  return (
    <strong className="browser-approval-title" title={summary}>
      <span>{parts.verb}</span>
      {parts.value ? <span className="browser-approval-value">{parts.value}</span> : null}
      {parts.joiner ? <span>{parts.joiner}</span> : null}
      <span className="browser-approval-object">{parts.target}</span>
    </strong>
  );
};
