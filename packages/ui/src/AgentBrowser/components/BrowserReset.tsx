import { useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog/index.tsx';
import { browserCommand } from '../api.ts';
import type { BrowserControl } from '../types.ts';
export function BrowserReset({
  roleId,
  thread,
  control,
}: {
  roleId: string;
  thread: string;
  control: BrowserControl;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" disabled={control.working} onClick={() => setOpen(true)}>
        Reset browser
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Reset this agent’s browser?</DialogTitle>
          <DialogDescription>
            This stops its current run, closes its browser and removes saved sign-ins and website
            storage. Packets and application history are kept.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={control.working}
              onClick={() =>
                void control.command(async () => {
                  await browserCommand(roleId, thread, 'close', { reset: true });
                  control.forget();
                  setOpen(false);
                })
              }
            >
              Reset browser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
