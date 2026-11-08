import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import type { ComputerApproval } from '@pitchcrew/core';
import type { ComputerApprovalsProps } from '../types.ts';
import { approveLabel } from '../helpers.ts';

type Props = Pick<ComputerApprovalsProps, 'action' | 'working'> & {
  approval: ComputerApproval;
  /** Decided where the result is already visible (the browser tray): no success toast. */
  quiet?: boolean;
};

/** The decision for one browser request: the verb-specific approval first, then Reject. */
export const BrowserApprovalActions = ({ approval, action, working, quiet }: Props) => {
  const [deciding, setDeciding] = useState<boolean | null>(null);
  if (approval.status !== 'pending') return null;
  const decide = (approved: boolean) => {
    setDeciding(approved);
    void action(
      `/computer-approvals/${approval.id}/decide`,
      'POST',
      { approved },
      quiet
        ? undefined
        : approved
          ? 'Browser action approved for this run'
          : 'Browser action rejected',
    )
      .catch(() => {})
      .finally(() => setDeciding(null));
  };
  const busy = working || deciding !== null;
  return (
    <div className="approval-footer">
      <Button disabled={busy} className="button primary" onClick={() => decide(true)}>
        {deciding === true ? 'Running…' : approveLabel(approval.action)}
      </Button>
      <Button disabled={busy} className="button" onClick={() => decide(false)}>
        {deciding === false ? 'Rejecting…' : 'Reject'}
      </Button>
    </div>
  );
};
