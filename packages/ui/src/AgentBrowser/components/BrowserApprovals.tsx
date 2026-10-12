import { BrowserApprovalContent } from '@/ComputerApprovals/components/BrowserApprovalContent.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { browserCommand } from '../api.ts';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
export function BrowserApprovals({
  browserPanel,
  data,
  thread,
  action,
  working,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
  control: BrowserControl;
}) {
  const approvals = data.computerApprovals.filter(
    (approval) =>
      approval.roleId === browserPanel.role?.id &&
      approval.runId === browserPanel.session?.runId &&
      approval.status === 'pending',
  );
  return (
    <div className="browser-approvals">
      {approvals.map((approval) => {
        const site = approval.action.kind === 'navigate' ? approval.action.url : approval.page.url;
        const origin = site.startsWith('http') ? new URL(site).origin : '';
        const allow =
          browserPanel.session?.mode === 'autonomous' &&
          origin &&
          !browserPanel.session.allowedSites.includes(origin);
        return (
          <section
            key={approval.id}
            className="browser-pending-action"
            aria-label="Pending browser action"
          >
            {allow ? (
              <div className="browser-site-request">
                <p>
                  Allow preparation on <strong>{origin}</strong> for this task? This can send form
                  answers and the approved, exported packet. Submission and unrecognized controls
                  still ask.
                </p>
                <Button
                  size="sm"
                  disabled={control.working}
                  onClick={() =>
                    void control.command(() =>
                      browserCommand(approval.roleId, thread, 'sites', {
                        taskId: browserPanel.session!.taskId,
                        url: site,
                        ...(approval.action.kind === 'navigate' ? { approvalId: approval.id } : {}),
                      }),
                    )
                  }
                >
                  Allow site for this task
                </Button>
              </div>
            ) : null}
            <BrowserApprovalContent
              approval={approval}
              action={action}
              working={working || !!browserPanel.session?.manual}
            />
          </section>
        );
      })}
    </div>
  );
}
