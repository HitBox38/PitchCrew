import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@pitchcrew/design-system/sheet';

export const JobSheet = ({ children, onClose }: { children: ReactNode; onClose: () => void }) => {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="modal drawer card-details-panel" showCloseButton={false}>
        <SheetTitle className="sr-only">Job details</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
};
