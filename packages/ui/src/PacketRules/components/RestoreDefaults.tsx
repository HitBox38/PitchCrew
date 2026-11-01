import { useRef } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';

export const RestoreDefaults = ({
  open,
  setOpen,
  onConfirm,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onConfirm: () => void;
}) => {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent initialFocus={cancel} className="modal" showCloseButton={false}>
        <DialogTitle>Restore the default rules?</DialogTitle>
        <DialogDescription>
          This removes packet-rules.json. Only the 650-word resume and 500-word cover letter limits
          remain. Export your rules first if you want to keep a copy.
        </DialogDescription>
        <div className="settings-form-actions">
          <Button ref={cancel} variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>
            Keep my rules
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Restore defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
