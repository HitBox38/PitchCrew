import { Button } from '@/components/ui/button/components/Button.tsx';
import { browserCommand } from '../api.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
export function BrowserSiteRequest({
  approval,
  browserPanel,
  thread,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & {
  approval: ComputerApproval;
  control: BrowserControl;
}) {
  const site = approval.action.kind === 'navigate' ? approval.action.url : approval.page.url;
  const origin = site.startsWith('http') ? new URL(site).origin : '';
  if (
    browserPanel.session?.mode !== 'autonomous' ||
    !origin ||
    browserPanel.session.allowedSites.includes(origin)
  )
    return null;
  return (
    <div className="browser-site-request">
      <p>
        Allow preparation on <strong>{origin}</strong> for this task? This allows form answers and
        approved packet files. Buttons and submission still ask.
      </p>
      <Button
        size="sm"
        disabled={control.working || !!browserPanel.session.manual || !!control.leaseId}
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
        Allow preparation for this task
      </Button>
    </div>
  );
}
