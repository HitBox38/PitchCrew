import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserPendingAction } from './BrowserPendingAction.tsx';
export function BrowserApprovals(
  props: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'thread' | 'action' | 'working'> & {
    control: BrowserControl;
  },
) {
  const approvals = props.data.computerApprovals.filter(
    (approval) =>
      approval.roleId === props.browserPanel.role?.id &&
      approval.runId === props.browserPanel.session?.runId &&
      approval.status === 'pending',
  );
  if (!approvals.length) return null;
  return (
    <footer className="browser-approvals" aria-label="Pending browser actions">
      {approvals.map((approval) => (
        <BrowserPendingAction key={approval.id} approval={approval} {...props} />
      ))}
    </footer>
  );
}
