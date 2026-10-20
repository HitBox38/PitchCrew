import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { Trash2 } from 'lucide-react';
import type { JobSource } from '@pitchcrew/core';
import type { JobSourcesModel } from '../types.ts';

export const RemoveSource = ({ source, model }: { source: JobSource; model: JobSourcesModel }) => {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={model.busy || !!model.draft}
        aria-label={`Remove source ${source.name}; keep its leads`}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent initialFocus={cancel} showCloseButton={false} className="modal">
          <DialogTitle>Remove {source.name}?</DialogTitle>
          <DialogDescription>
            This stops future scans of this job board. Jobs already added to your pipeline stay on
            the board.
          </DialogDescription>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button ref={cancel} variant="outline" onClick={() => setOpen(false)}>
              Keep source
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                model.remove(source);
              }}
            >
              Remove source
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
