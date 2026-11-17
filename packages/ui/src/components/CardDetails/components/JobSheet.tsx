import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@pitchcrew/design-system/sheet';

export const JobSheet = ({
  children,
  onClose,
  comparing,
}: {
  children: ReactNode;
  onClose: () => void;
  comparing?: boolean;
}) => {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="modal drawer card-details-panel"
        data-comparing={comparing ? '' : undefined}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Job details</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
};
