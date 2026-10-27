import { Button } from '@/components/ui/button/components/Button.tsx';
import { browserCommand } from '../api.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
export const BrowserSiteRequest = ({
  approval,
  browserPanel,
  thread,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & {
  approval: ComputerApproval;
  control: BrowserControl;
}) => {
  const site = approval.action.kind === 'navigate' ? approval.action.url : approval.page.url;
  const origin = site.startsWith('http') ? new URL(site).origin : '';
  if (
    browserPanel.session?.mode !== 'autonomous' ||
    !origin ||
    (browserPanel.session.allowedSites.includes(origin) &&
      (browserPanel.session.explorationSites ?? []).includes(origin))
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
        variant="outline"
        disabled={
          control.working ||
          !!browserPanel.session.manual ||
          !!control.leaseId ||
          (browserPanel.session.explorationSites ?? []).includes(origin)
        }
        onClick={() =>
          void control.command(() =>
            browserCommand(approval.roleId, thread, 'sites', {
              taskId: browserPanel.session!.taskId,
              url: site,
              exploration: true,
              ...(approval.action.kind === 'navigate' ? { approvalId: approval.id } : {}),
            }),
          )
        }
      >
        Allow browsing for this task
      </Button>
      <p className="quiet">
        Browsing allows navigation, scrolling and hover on this site. Clicks, form changes, files
        and submission still ask.
      </p>
      <Button
        size="sm"
        disabled={
          control.working ||
          !!browserPanel.session.manual ||
          !!control.leaseId ||
          browserPanel.session.allowedSites.includes(origin)
        }
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
};
