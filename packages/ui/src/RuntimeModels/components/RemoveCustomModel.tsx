import { useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@pitchcrew/design-system/dialog';
import { Trash2 } from 'lucide-react';
import type { RuntimeModel } from '@pitchcrew/core';
import type { RuntimeModelsModel } from '../types.ts';

export const RemoveCustomModel = ({
  entry,
  model,
  disabled,
}: {
  entry: RuntimeModel;
  model: RuntimeModelsModel;
  disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={`Remove custom model ${entry.label}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent initialFocus={cancel} showCloseButton={false} className="modal">
          <DialogTitle>Remove {entry.label}?</DialogTitle>
          <DialogDescription>
            This removes its custom picker definition. If an agent or conversation still uses this
            selector, change its saved model first. Existing choices are never rewritten.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button ref={cancel} variant="outline" onClick={() => setOpen(false)}>
              Keep model
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setOpen(false);
                if (await model.remove(entry.value))
                  requestAnimationFrame(() =>
                    document.getElementById(`runtime-${model.id}-add-custom-model`)?.focus(),
                  );
              }}
            >
              Remove model
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
