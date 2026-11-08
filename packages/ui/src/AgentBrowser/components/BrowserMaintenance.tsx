import { useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@pitchcrew/design-system/dropdown-menu';
import { browserCommand } from '../api.ts';
import type { AgentBrowserProps, BrowserControl } from '../types.ts';
import { BrowserReset } from './BrowserReset.tsx';
import { BrowserControlItems } from './BrowserControlItems.tsx';

export const BrowserMaintenance = ({
  browserPanel,
  thread,
  control,
}: Pick<AgentBrowserProps, 'browserPanel' | 'thread'> & { control: BrowserControl }) => {
  const [reset, setReset] = useState(false);
  const roleId = browserPanel.role!.id;
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Browser options"
              disabled={control.working}
            />
          }
        >
          <Ellipsis size={18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <BrowserControlItems browserPanel={browserPanel} control={control} />
          <DropdownMenuGroup>
            {browserPanel.session?.status === 'open' ? (
              <DropdownMenuItem
                onClick={() =>
                  void control.command(async () => {
                    await browserCommand(roleId, thread, 'close');
                    control.forget();
                  })
                }
              >
                {browserPanel.session.runId ? 'Stop run and close browser' : 'Close browser'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem variant="destructive" onClick={() => setReset(true)}>
              Reset saved sign-ins…
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <BrowserReset
        roleId={roleId}
        thread={thread}
        control={control}
        open={reset}
        setOpen={setReset}
      />
    </>
  );
};
