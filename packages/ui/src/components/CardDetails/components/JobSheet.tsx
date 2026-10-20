import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/sheet/components/Sheet.tsx';
import { SheetContent } from '@/components/ui/sheet/components/SheetContent.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';

export function JobSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
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
}
