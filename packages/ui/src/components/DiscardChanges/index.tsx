import { useRef } from 'react';
import type { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function DiscardChanges({ guard }: { guard: ReturnType<typeof useUnsavedChanges> }) {
  const keepFocus = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={guard.open}
      onOpenChange={(open) => {
        if (!open) guard.keepEditing();
      }}
    >
      <DialogContent initialFocus={keepFocus} className="modal" showCloseButton={false}>
        <DialogTitle>Discard unsaved changes?</DialogTitle>
        <DialogDescription className="discard-description">
          Your edits haven’t been saved. Keep editing to save them, or discard them to continue.
        </DialogDescription>
        <div className="form-footer mt-0.5 flex justify-end gap-2.5 border-t border-border pt-4">
          <Button className="button" onClick={guard.discard}>
            Discard changes
          </Button>
          <Button ref={keepFocus} className="button primary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
