import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@pitchcrew/design-system/dropdown-menu';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';

/**
 * Explicit control for the cases the header leaves out: keep the page private while starting a
 * task (Take control while idle), or give back control taken by browsing (Return to agent).
 */
export const BrowserControlItems = ({
  browserPanel,
  control,
}: Pick<AgentBrowserProps, 'browserPanel'> & { control: BrowserControl }) => {
  const session = browserPanel.session;
  if (session?.status !== 'open') return null;
  const idle = !session.runId && !session.manual && !control.leaseId;
  const implicit = !!control.leaseId && control.implicit;
  if (!idle && !implicit) return null;
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem
          disabled={control.working}
          onClick={() => void (implicit ? control.release() : control.take())}
        >
          {implicit ? 'Return to agent' : 'Take control'}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
};
