import { browserCommand } from '../api.ts';
import type { ComputerApproval } from '@pitchcrew/core';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { ClaySiteRequest } from './ClaySiteRequest.tsx';
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
  const session = browserPanel.session;
  if (
    session?.mode !== 'autonomous' ||
    !origin ||
    (session.allowedSites.includes(origin) && (session.explorationSites ?? []).includes(origin))
  )
    return null;
  const paused = control.working || !!session.manual || !!control.leaseId;
  const browseDisabled = paused || (session.explorationSites ?? []).includes(origin);
  const prepareDisabled = paused || session.allowedSites.includes(origin);
  const grant = (exploration: boolean) =>
    void control.command(() =>
      browserCommand(approval.roleId, thread, 'sites', {
        taskId: session.taskId,
        url: site,
        ...(exploration ? { exploration: true } : {}),
        ...(approval.action.kind === 'navigate' ? { approvalId: approval.id } : {}),
      }),
    );
  return <ClaySiteRequest {...{ origin, browseDisabled, prepareDisabled, grant }} />;
};
