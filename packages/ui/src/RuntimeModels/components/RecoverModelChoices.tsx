import { useRef, useState } from 'react';
import { api } from '@/api.ts';
import type { RuntimeId } from '@pitchcrew/core';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';

export const RecoverModelChoices = ({
  runtime,
  reload,
}: {
  runtime: RuntimeId;
  reload: () => Promise<boolean>;
}) => {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [reset, setReset] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const recover = async () => {
    setWorking(true);
    setError('');
    try {
      if (!reset) {
        await api(`/runtimes/${runtime}/model-preferences/reset`, 'POST', { confirmed: true });
        setReset(true);
      }
      if (await reload()) setOpen(false);
      else
        setError(
          'Choices were reset and a backup was kept, but the list could not refresh. Retry loading or close this dialog.',
        );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not recover model choices.');
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Recover model choices
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!working) setOpen(value);
        }}
      >
        <DialogContent className="modal" initialFocus={cancel} showCloseButton={false}>
          <DialogTitle>Reset saved model choices?</DialogTitle>
          <DialogDescription>
            The saved file cannot be read. This keeps a backup in the workspace data folder and
            resets favorites, visibility, order and custom definitions for all runtimes. Agent and
            conversation selections stay unchanged; custom reasoning definitions they used may need
            restoring from the backup.
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
              {reset ? 'Close' : 'Keep choices'}
            </Button>
            <Button
              variant={reset ? 'default' : 'destructive'}
              disabled={working}
              onClick={() => void recover()}
            >
              {reset ? 'Retry loading' : 'Reset model choices'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
