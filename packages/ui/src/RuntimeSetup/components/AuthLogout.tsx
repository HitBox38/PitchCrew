import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogHeader,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
import type { RuntimeSetupRequest } from '../types.ts';
import type { RuntimeId } from '@pitchcrew/core';
import { runtimeLabels } from '@/lib/labels.ts';

export const AuthLogout = ({
  request,
  disabled,
  workspace,
  runtime,
}: {
  request: RuntimeSetupRequest;
  disabled: boolean;
  workspace: boolean;
  runtime: RuntimeId;
}) => {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        Sign out
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!working) setOpen(value);
        }}
      >
        <DialogContent
          className="modal"
          initialFocus={cancel}
          showCloseButton={false}
          forceRenderBackdrop
        >
          <DialogHeader className="mb-4">
            <DialogTitle>Sign out of {runtimeLabels[runtime]}?</DialogTitle>
            <DialogDescription>
              {workspace
                ? 'This clears the sign-in managed by this Pitchcrew workspace. A configured API key will apply again.'
                : 'This asks the native CLI to clear its current sign-in, if any. It can change the account used by this CLI outside Pitchcrew.'}{' '}
              Conversation history is kept.
            </DialogDescription>
          </DialogHeader>
          {failed && (
            <p role="alert">
              Sign-out could not start. Close this confirmation to review the runtime error.
            </p>
          )}
          <div className="form-footer flex justify-end gap-2">
            <Button
              ref={cancel}
              variant="outline"
              disabled={working}
              onClick={() => setOpen(false)}
            >
              Keep account
            </Button>
            <Button
              variant="destructive"
              disabled={working}
              onClick={() => {
                setWorking(true);
                setFailed(false);
                void request('/auth/logout')
                  .then((ok) => {
                    if (ok) setOpen(false);
                    else setFailed(true);
                  })
                  .finally(() => setWorking(false));
              }}
            >
              Sign out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
