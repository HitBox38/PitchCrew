import type { ModalProps } from '@/components/Modal/types.ts';
import { Button } from '@pitchcrew/design-system/button';
import { Dialog, DialogContent, DialogTitle } from '@pitchcrew/design-system/dialog';
import { Sheet, SheetContent, SheetTitle } from '@pitchcrew/design-system/sheet';
import { X } from 'lucide-react';

export const Modal = ({
  title,
  children,
  onClose,
  drawer = false,
  className = '',
  initialFocus,
  finalFocus,
  closeDisabled = false,
}: ModalProps) => {
  if (drawer)
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent
          className={`modal drawer ${className}`}
          showCloseButton={false}
          initialFocus={initialFocus}
          finalFocus={finalFocus}
        >
          <div className="modal-heading flex items-center justify-between gap-4">
            <SheetTitle>{title}</SheetTitle>
            <Button
              variant="ghost"
              className="icon-button"
              onClick={onClose}
              aria-label="Close dialog"
              disabled={closeDisabled}
            >
              <X size={20} />
            </Button>
          </div>
          {children}
        </SheetContent>
      </Sheet>
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`modal ${className}`}
        showCloseButton={false}
        initialFocus={initialFocus}
        finalFocus={finalFocus}
      >
        <div className="modal-heading flex items-center justify-between gap-4">
          <DialogTitle>{title}</DialogTitle>
          <Button
            variant="ghost"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={closeDisabled}
          >
            <X size={20} />
          </Button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
};
