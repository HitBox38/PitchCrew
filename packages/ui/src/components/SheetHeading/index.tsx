import { Button } from '@/components/ui/button/components/Button.tsx';
import { SheetTitle } from '@/components/ui/sheet/components/SheetTitle.tsx';
import { X } from 'lucide-react';

/** Matches Modal's heading so form sheets share their title style and close control. */
export const SheetHeading = ({ title, onClose }: { title: string; onClose: () => void }) => {
  return (
    <div className="modal-heading flex items-center justify-between gap-4">
      <SheetTitle>{title}</SheetTitle>
      <Button variant="ghost" className="icon-button" onClick={onClose} aria-label="Close dialog">
        <X size={20} />
      </Button>
    </div>
  );
};
