import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@pitchcrew/design-system/dropdown-menu';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';

/**
 * Explicit control while the agent is idle: keep the page private until you return it, even if
 * a task starts (browsing alone hands control back when the agent starts working).
 */
export const BrowserControlItems = ({
  browserPanel,
  control,
}: Pick<AgentBrowserProps, 'browserPanel'> & { control: BrowserControl }) => {
  const session = browserPanel.session;
  if (session?.status !== 'open' || session.runId) return null;
  // Held explicitly already, or held elsewhere/lapsed (the header offers Recover control).
  if (control.leaseId ? !control.implicit : session.manual) return null;
  const name = browserPanel.role?.name ?? 'the agent';
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem
          disabled={control.working}
          title={`${name} waits for this page until you return it, even if a task starts.`}
          onClick={control.keep}
        >
          Keep control until I return it
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
};
