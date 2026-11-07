import { useRef, useState } from 'react';
import type { RuntimeId } from '@pitchcrew/core';
import { useConnectionRecovery } from '../hooks/useConnectionRecovery.ts';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';

export const ConnectionRecovery = ({
  runtime,
  blocked,
  reload,
  onWorkingChange,
  onSaved,
  onRecovered,
}: {
  runtime: RuntimeId;
  blocked: boolean;
  reload: () => Promise<boolean>;
  onWorkingChange: (working: boolean) => void;
  onSaved: () => void;
  onRecovered: (backup: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const { working, error, reset, recover } = useConnectionRecovery({
    runtime,
    reload,
    onWorkingChange,
    onSaved,
    onRecovered,
  });
  return (
    <div className="settings-stack settings-callout runtime-model-notice">
      <p role="alert">
        Saved credentials cannot be read. Runtime work is blocked until you recover the
        authentication settings.
      </p>
      <Button disabled={blocked} onClick={() => setOpen(true)}>
        Recover authentication settings
      </Button>
      {blocked && !working ? (
        <p className="quiet">
          Wait for runtime work, setup and checks to finish before recovering shared authentication
          settings.
        </p>
      ) : null}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!working) setOpen(value);
        }}
      >
        <DialogContent className="modal" initialFocus={cancel} showCloseButton={false}>
          <DialogTitle>Reset saved authentication settings?</DialogTitle>
          <DialogDescription>
            This keeps a backup in the private credentials folder and resets saved keys and
            authentication variables for all runtimes. The backup contains secrets; keep it private.
            Native CLI accounts and managed sign-ins are kept. Saved agent and conversation
            selections are kept. Daemon environment values will apply again.
          </DialogDescription>
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          <div className="form-footer flex justify-end gap-2">
            <Button
              ref={cancel}
              variant="outline"
              disabled={working}
              onClick={() => setOpen(false)}
            >
              {reset ? 'Close' : 'Keep settings'}
            </Button>
            <Button
              variant={reset ? 'default' : 'destructive'}
              disabled={working}
              onClick={() =>
                void recover().then((recovered) => {
                  if (recovered) setOpen(false);
                })
              }
            >
              {reset ? 'Retry loading' : 'Reset authentication settings'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
