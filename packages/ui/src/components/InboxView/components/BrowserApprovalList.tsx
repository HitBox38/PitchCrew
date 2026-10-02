import type { BrowserApprovalListProps } from '@/components/InboxView/types.ts';
import { ComputerApprovals } from '@/ComputerApprovals/index.tsx';

export function BrowserApprovalList({
  computerApprovals,
  action,
  working,
}: BrowserApprovalListProps) {
  return (
    <div className="approval-list">
      <ComputerApprovals approvals={computerApprovals} action={action} working={working} />
    </div>
  );
}
