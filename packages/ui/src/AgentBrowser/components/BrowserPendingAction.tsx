import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { BrowserApprovalContent } from '@/ComputerApprovals/components/BrowserApprovalContent.tsx';
import { BrowserApprovalActions } from '@/ComputerApprovals/components/BrowserApprovalActions.tsx';
import { browserActionTitles, actionFields } from '@/ComputerApprovals/helpers.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserSiteRequest } from './BrowserSiteRequest.tsx';
export function BrowserPendingAction({
  approval,
  browserPanel,
  thread,
  action,
  working,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread' | 'action' | 'working'> & {
  approval: ComputerApproval;
  control: BrowserControl;
}) {
  const paused = !!browserPanel.session?.manual || !!control.leaseId;
  return (
    <section
      className="browser-pending-action"
      aria-label="Pending browser action"
      data-browser-approval-id={approval.id}
    >
      <div className="browser-approval-body">
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
        <AccordionSection
          className="browser-evidence"
          heading="Review exact action and page evidence"
        >
          <BrowserApprovalContent
            approval={approval}
            action={action}
            working={working || paused}
            showActions={false}
          />
        </AccordionSection>
        {paused ? (
          <p className="quiet">
            Return control before deciding. The agent will refresh its request.
          </p>
        ) : null}
        {approval.error ? (
          <p className="form-error" role="alert">
            {approval.error}
          </p>
        ) : null}
      </div>
      <BrowserApprovalActions
        approval={approval}
        action={action}
        working={working || paused || control.working}
      />
    </section>
  );
}
