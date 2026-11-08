import { ChevronRight, LockKeyhole } from 'lucide-react';
import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { BrowserApprovalError } from '@/ComputerApprovals/components/BrowserApprovalError.tsx';
import { approvalSummary } from '@/ComputerApprovals/helpers.ts';
import { BrowserApprovalTitle } from './BrowserApprovalTitle.tsx';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserSiteRequest } from './BrowserSiteRequest.tsx';
import { BrowserApprovalEvidence } from './BrowserApprovalEvidence.tsx';
import { useApprovalTarget } from '../hooks/useApprovalTarget.ts';
import { BrowserControls } from './BrowserControls.tsx';

/**
 * One waiting request in two short lines: what will happen, written by Pitchcrew with the exact
 * value (bead or lock, semibold), and the agent's reason (muted, one line). Site access, Details
 * and the decision sit on the right.
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
  useApprovalTarget(approval.id, approval.status === 'pending' && !paused);
  // One condition for every decision surface (the tray and Details), including a takeover in flight.
  const blocked = working || paused || control.working;
  return (
    <section
      className="browser-pending-action"
      aria-label="Pending browser action"
      data-browser-approval-id={approval.id}
      data-submission={submission || undefined}
      // A typed, chosen or uploaded value takes the line's room; Take over stays an icon then.
      data-value={'value' in approval.action || approval.action.kind === 'upload' || undefined}
    >
      <div className="browser-approval-body">
        {/* The two lines are the Details trigger: the evidence is one click on the request. */}
        <BrowserApprovalEvidence
          approval={approval}
          action={action}
          working={blocked}
          summary={summary}
        >
          <span className="browser-approval-line">
            {submission ? (
              <LockKeyhole size={13} className="browser-approval-lock" aria-label="Submission" />
            ) : (
              <span className="clay-bead" data-size="sm" data-tone="ochre" aria-hidden="true" />
            )}
            <BrowserApprovalTitle approval={approval} summary={summary} />
            <ChevronRight size={14} className="browser-approval-more" aria-hidden="true" />
          </span>
          <span className="browser-approval-reason" title={reason}>
            {reason}
          </span>
        </BrowserApprovalEvidence>
        <BrowserApprovalError approval={approval} />
      </div>
      {/* Return control before deciding, or take the page instead of approving it. */}
      <BrowserControls
        browserPanel={browserPanel}
        thread={thread}
        control={control}
        compact={!paused}
      />
      <BrowserSiteRequest
        approval={approval}
        browserPanel={browserPanel}
        thread={thread}
        control={control}
      />
      <BrowserApprovalActions
        approval={approval}
        action={action}
        working={blocked}
        quiet
        shortcut
      />
    </section>
  );
};
