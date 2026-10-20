import { useRef } from 'react';
import type { Conversation } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/index.tsx';

export const DeleteConversationDialog = ({
  conversation,
  working,
  close,
  confirm,
}: {
  conversation: Conversation | null;
  working: boolean;
  close: () => void;
  confirm: () => Promise<void>;
}) => {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={!!conversation}
      onOpenChange={(open) => {
        if (!open && !working) close();
      }}
    >
      <DialogContent
        className="modal"
        initialFocus={cancel}
        finalFocus={false}
        showCloseButton={false}
      >
        <DialogTitle>Delete this conversation?</DialogTitle>
        <DialogDescription>
          Remove “{conversation?.title}” and its messages from your workspace? Queued replies and
          follow-ups will be cancelled and attached routines paused. There is no restore action.
          Stored event history, local files and separately saved agent memories stay on this device.
        </DialogDescription>
        <div className="form-footer flex justify-end gap-2">
          <Button ref={cancel} variant="outline" disabled={working} onClick={close}>
            Keep conversation
          </Button>
          <Button className="button danger" disabled={working} onClick={() => void confirm()}>
            Delete conversation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
