import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
export const WithdrawConfirmation = ({
  open,
  close,
  confirm,
  busy,
}: {
  open: boolean;
  close: () => void;
  confirm: () => void;
  busy: boolean;
}) => (
  <Dialog
    open={open}
    onOpenChange={(value) => {
      if (!value) close();
    }}
  >
    <DialogContent>
      <DialogTitle>Not applying to this job?</DialogTitle>
      <DialogDescription>
        This marks the job Withdrawn and closes its Inbox follow-up. Your history and exported files
        stay saved. It doesn’t contact the employer.
      </DialogDescription>
      <DialogFooter>
        <Button variant="outline" onClick={close}>
          Keep application
        </Button>
        <Button disabled={busy} onClick={confirm}>
          Mark withdrawn
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
