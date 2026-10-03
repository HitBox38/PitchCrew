import type { ModalProps } from '@/components/Modal/types.ts';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Dialog } from '@/components/ui/dialog/components/Dialog.tsx';
import { DialogContent } from '@/components/ui/dialog/components/DialogContent.tsx';
import { DialogTitle } from '@/components/ui/dialog/components/DialogTitle.tsx';
import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose, drawer = false, className = '' }: ModalProps) {
  if (drawer)
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent className={`modal drawer ${className}`} showCloseButton={false}>
          <div className="modal-heading">
            <SheetTitle>{title}</SheetTitle>
            <Button
              variant="ghost"
              className="icon-button"
              onClick={onClose}
              aria-label="Close dialog"
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
      <DialogContent className={`modal ${className}`} showCloseButton={false}>
        <div className="modal-heading">
          <DialogTitle>{title}</DialogTitle>
          <Button
            variant="ghost"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </Button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
