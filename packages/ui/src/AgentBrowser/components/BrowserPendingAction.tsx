import { LockKeyhole } from 'lucide-react';
import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { BrowserApprovalError } from '@/ComputerApprovals/components/BrowserApprovalError.tsx';
import { approvalSummary } from '@/ComputerApprovals/helpers.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserSiteRequest } from './BrowserSiteRequest.tsx';
import { BrowserApprovalEvidence } from './BrowserApprovalEvidence.tsx';

/**
 * One waiting request as one line: an ochre bead, what will happen, the agent's reason, Details,
 * and the decision. Exact action fields and page evidence live in Details.
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
  return (
    <section
      className="browser-pending-action"
      aria-label="Pending browser action"
      data-browser-approval-id={approval.id}
      data-submission={submission || undefined}
    >
      <div className="browser-approval-body">
        <p className="browser-approval-line" title={approval.reason}>
          {submission ? (
            <LockKeyhole size={13} className="browser-approval-lock" aria-label="Submission" />
          ) : (
            <span className="clay-bead" data-size="sm" data-tone="ochre" aria-hidden="true" />
          )}
          <strong>{summary}</strong>
          <span className="browser-approval-reason">
            {paused ? 'Return control before deciding.' : approval.reason}
          </span>
        </p>
        <BrowserSiteRequest
          approval={approval}
          browserPanel={browserPanel}
          thread={thread}
          control={control}
        />
        <BrowserApprovalError approval={approval} />
      </div>
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
