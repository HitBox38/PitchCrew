import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/index.tsx';

export function RestoreDefaults({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button className="button" disabled={disabled} onClick={() => setOpen(true)}>
        Restore defaults
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent initialFocus={cancel} className="modal" showCloseButton={false}>
          <DialogTitle>Restore the default rules?</DialogTitle>
          <DialogDescription>
            This removes packet-rules.json. Only the 650-word resume and 500-word cover letter
            limits remain. Export your rules first if you want to keep a copy.
          </DialogDescription>
          <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
            <Button ref={cancel} className="button" onClick={() => setOpen(false)}>
              Keep my rules
            </Button>
            <Button
              className="button primary"
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
    </>
  );
}
