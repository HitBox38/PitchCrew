import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { BrowserApprovalError } from '@/ComputerApprovals/components/BrowserApprovalError.tsx';
import { browserActionTitles, actionFields } from '@/ComputerApprovals/helpers.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserSiteRequest } from './BrowserSiteRequest.tsx';
import { BrowserApprovalEvidence } from './BrowserApprovalEvidence.tsx';
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
  return (
    <section
      className="browser-pending-action"
      aria-label="Pending browser action"
      data-browser-approval-id={approval.id}
    >
      <div className="browser-approval-body">
        <p className="browser-approval-kind" data-tone={submission ? 'rose' : 'ochre'}>
          <span>{submission ? 'Approve submission' : 'Needs approval'}</span>
          {browserPanel.role?.name} · this run only
        </p>
        <h3>{browserActionTitles[approval.action.kind]}</h3>
        <p className="browser-approval-reason">{approval.reason}</p>
        <dl className="browser-action-brief">
          {actionFields(approval.action)
            .filter(([label]) => label !== 'Frame' && label !== 'Submission attempt')
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || 'Empty text'}</dd>
              </div>
            ))}
        </dl>
        <BrowserSiteRequest
          approval={approval}
          browserPanel={browserPanel}
          thread={thread}
          control={control}
        />
        <BrowserApprovalEvidence approval={approval} action={action} working={working || paused} />
        {paused ? (
          <p className="quiet">
            Return control before deciding. The agent will refresh its request.
          </p>
        ) : null}
        <BrowserApprovalError approval={approval} />
      </div>
      <BrowserApprovalActions
        approval={approval}
        action={action}
        working={working || paused || control.working}
      />
    </section>
  );
};
