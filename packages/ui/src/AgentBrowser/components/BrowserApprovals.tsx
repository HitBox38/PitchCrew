import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserPendingAction } from './BrowserPendingAction.tsx';
import { ClayApprovalIdle } from './ClayApprovalIdle.tsx';
export const BrowserApprovals = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
    control: BrowserControl;
    /** The panel's shown view; an open browser on the browser view reserves the tray. */
    view: 'browser' | 'packet';
    nudged: boolean;
  },
) => {
  const session = props.browserPanel.session;
  // Reserved for the whole open session, so a run starting or ending never resizes the page.
  const reserveSpace = props.view === 'browser' && session?.status === 'open';
  const approvals = props.data.computerApprovals.filter(
    (approval) =>
      approval.roleId === props.browserPanel.role?.id &&
      approval.runId === props.browserPanel.session?.runId &&
      approval.status === 'pending',
  );
  if (!approvals.length && !reserveSpace) return null;
  return (
    <footer
      className="browser-approvals"
      data-reserved={reserveSpace || undefined}
      data-mode={session?.mode}
      aria-label="Browser action review"
    >
      {!approvals.length ? (
        <ClayApprovalIdle
          browserPanel={props.browserPanel}
          data={props.data}
          thread={props.thread}
          action={props.action}
          working={props.working}
          control={props.control}
          nudged={props.nudged}
        />
      ) : null}
      {approvals.map((approval) => (
        <BrowserPendingAction key={approval.id} approval={approval} {...props} />
      ))}
    </footer>
  );
};
