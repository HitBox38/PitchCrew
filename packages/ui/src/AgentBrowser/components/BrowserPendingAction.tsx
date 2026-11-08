import { LockKeyhole } from 'lucide-react';
import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { BrowserApprovalError } from '@/ComputerApprovals/components/BrowserApprovalError.tsx';
import { approvalSummary } from '@/ComputerApprovals/helpers.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserSiteRequest } from './BrowserSiteRequest.tsx';
import { BrowserApprovalEvidence } from './BrowserApprovalEvidence.tsx';

/**
 * One waiting request in two short lines: what will happen (bead or lock, semibold) and the
 * agent's reason (muted, one line). Site access, Details and the decision sit on the right.
 */
export const BrowserPendingAction = ({
  approval,
  browserPanel,
  thread,
  action,
  working,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread' | 'action' | 'working'> & {
  approval: ComputerApproval;
  control: BrowserControl;
}) => {
  const paused = !!browserPanel.session?.manual || !!control.leaseId;
  const submission = 'purpose' in approval.action && approval.action.purpose === 'submission';
  const summary = approvalSummary(approval.action, approval.page);
  const reason = paused ? 'Return control before deciding.' : approval.reason;
  return (
    <section
      className="browser-pending-action"
      aria-label="Pending browser action"
      data-browser-approval-id={approval.id}
      data-submission={submission || undefined}
    >
      <div className="browser-approval-body">
        <p className="browser-approval-line">
          {submission ? (
            <LockKeyhole size={13} className="browser-approval-lock" aria-label="Submission" />
          ) : (
            <span className="clay-bead" data-size="sm" data-tone="ochre" aria-hidden="true" />
          )}
          <strong title={summary || reason}>{summary || reason}</strong>
        </p>
        {summary ? (
          <p className="browser-approval-reason" title={reason}>
            {reason}
          </p>
        ) : null}
        <BrowserApprovalError approval={approval} />
      </div>
      <BrowserSiteRequest
        approval={approval}
        browserPanel={browserPanel}
        thread={thread}
        control={control}
      />
      <BrowserApprovalEvidence approval={approval} action={action} working={working || paused} />
      <BrowserApprovalActions
        approval={approval}
        action={action}
        working={working || paused || control.working}
        quiet
      />
    </section>
  );
};
