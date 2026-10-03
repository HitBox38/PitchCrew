import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ComputerApproval } from '@pitchcrew/core';
import type { ComputerApprovalsProps } from '../types.ts';

type Props = Pick<ComputerApprovalsProps, 'action' | 'working'> & { approval: ComputerApproval };
export function BrowserApprovalActions({ approval, action, working }: Props) {
  if (approval.status !== 'pending') return null;
  const decide = (approved: boolean) => {
    void action(
      `/computer-approvals/${approval.id}/decide`,
      'POST',
      { approved },
      approved ? 'Browser action approved for this run' : 'Browser action rejected',
    ).catch(() => {});
  };
  return (
    <div className="approval-footer">
      <Button disabled={working} className="button" onClick={() => decide(false)}>
        Reject
      </Button>
      <Button disabled={working} className="button primary" onClick={() => decide(true)}>
        Approve interaction
      </Button>
    </div>
  );
}
