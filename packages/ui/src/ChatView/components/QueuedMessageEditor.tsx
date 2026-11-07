import { useRef } from 'react';
import type { ChatRequest } from '@pitchcrew/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { QueuedComposerEditor } from './QueuedComposerEditor.tsx';
import { SavedQueueAttachments } from './SavedQueueAttachments.tsx';
import type { useQueuedMessage } from '../hooks/useQueuedMessage.ts';
import { canEditQueuedMessage } from '../queue-presentation.ts';

export const QueuedMessageEditor = ({
  request,
  editor,
  working,
  started = false,
}: {
  request: ChatRequest;
  editor: ReturnType<typeof useQueuedMessage>;
  working: boolean;
  started?: boolean;
}) => {
  const inputRef = useRef<HTMLDivElement>(null);
  const guard = useUnsavedChanges(editor.editing && editor.dirty, editor.cancel);
  const eligible = !started && canEditQueuedMessage(request);
  const disabled = working || editor.saving;
  const valid =
    editor.content.length <= 8000 && (!!editor.content.trim() || !!request.attachments.length);
  return (
    <>
      <Dialog
        open={editor.editing}
        onOpenChange={(open) => {
          if (!open && !disabled) guard.requestLeave(editor.cancel);
        }}
      >
        <DialogContent
          className="chat-queued-editor"
          showCloseButton={false}
          initialFocus={inputRef}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!disabled && valid && eligible) void editor.save();
            }}
          >
            <DialogHeader>
              <DialogTitle>Edit queued message</DialogTitle>
              <DialogDescription>
                Save changes to this waiting message. It keeps its place in the queue.
              </DialogDescription>
            </DialogHeader>
            <div className="chat-queued-editor-body">
              <QueuedComposerEditor
                key={editor.editing ? request.id : 'closed'}
                content={editor.content}
                references={editor.references}
                disabled={disabled}
                inputRef={inputRef}
                onChange={editor.change}
              />
              <SavedQueueAttachments files={request.attachments} />
              {!eligible ? (
                <p className="form-error">
                  This message has started. Send a correction in the conversation instead.
                </p>
              ) : null}
              {editor.error ? (
                <p className="form-error" role="alert">
                  {editor.error}
                </p>
              ) : null}
              {editor.content.length > 8000 ? (
                <p className="form-error">Keep the message under 8,000 characters.</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="ghost" disabled={disabled} onClick={editor.cancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={disabled || !eligible || !valid}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <DiscardChanges guard={guard} finalFocus={inputRef} />
    </>
  );
};
