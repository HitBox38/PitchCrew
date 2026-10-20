import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { X } from 'lucide-react';
import { browserCommand } from '../api.ts';
import type { BrowserControl } from '../types.ts';
export const BrowserReset = ({
  roleId,
  thread,
  control,
  open,
  setOpen,
}: {
  roleId: string;
  thread: string;
  control: BrowserControl;
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="modal" showCloseButton={false}>
        <div className="modal-heading flex items-center justify-between gap-4">
          <DialogTitle>Reset this agent’s browser?</DialogTitle>
          <Button
            className="icon-button"
            variant="ghost"
            aria-label="Close dialog"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>
        <DialogDescription className="modal-intro">
          This stops its current run, closes its browser and removes saved sign-ins and website
          storage. Packets and application history are kept.
        </DialogDescription>
        <div className="flex justify-end gap-3">
          <Button className="text-button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
