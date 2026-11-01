import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserPendingAction } from './BrowserPendingAction.tsx';
import { ClayApprovalIdle } from './ClayApprovalIdle.tsx';
export const BrowserApprovals = (
  props: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
    control: BrowserControl;
    reserveSpace?: boolean;
  },
) => {
  const approvals = props.data.computerApprovals.filter(
    (approval) =>
      approval.roleId === props.browserPanel.role?.id &&
      approval.runId === props.browserPanel.session?.runId &&
      approval.status === 'pending',
  );
  if (!approvals.length && !props.reserveSpace) return null;
  return (
    <footer
      className="browser-approvals"
      data-reserved={props.reserveSpace || undefined}
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
        />
      ) : null}
      {approvals.map((approval) => (
        <BrowserPendingAction key={approval.id} approval={approval} {...props} />
      ))}
    </footer>
  );
};
