import { useRef } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@pitchcrew/design-system/dialog';

export const DiscardCustomModel = ({
  open,
  setOpen,
  discard,
  returnFocus,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  discard: () => void;
  returnFocus: () => HTMLElement | null;
}) => {
  const keep = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="modal"
        initialFocus={keep}
        finalFocus={returnFocus}
        showCloseButton={false}
      >
        <DialogTitle>Discard model changes?</DialogTitle>
        <DialogDescription>Your custom model definition has not been saved.</DialogDescription>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button ref={keep} variant="outline" onClick={() => setOpen(false)}>
            Keep editing
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              setOpen(false);
              discard();
            }}
          >
            Discard changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
