import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import type { Card } from '@pitchcrew/core';
import { useRef } from 'react';

export const DeleteJobDialog = ({
  card,
  disabled,
  working,
  close,
  confirm,
}: {
  card: Card | null;
  disabled: boolean;
  working: boolean;
  close: () => void;
  confirm: () => void;
}) => {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={!!card}
      onOpenChange={(open) => {
        if (!open && !working) close();
      }}
    >
      <DialogContent
        className="modal"
        initialFocus={cancel}
        finalFocus={false}
        showCloseButton={false}
      >
        <DialogTitle>Delete this job?</DialogTitle>
        <DialogDescription>
          Remove {card?.title} at {card?.company} from the board? Stored history and exported files
          stay on this device. Queued follow-ups will be cancelled and attached routines paused.
          There is no Trash or restore action. Use Mark withdrawn instead if you may revisit this
          job.
        </DialogDescription>
        <div className="form-footer flex justify-end gap-2">
          <Button ref={cancel} variant="outline" disabled={working} onClick={close}>
            Keep job
          </Button>
          <Button className="button danger" disabled={disabled} onClick={confirm}>
            Delete job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
