import { useRef, useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@pitchcrew/design-system/dialog';
import { keepRemoteActionFocus } from '../focus.ts';

export const StopRemoteConnection = ({
  apps,
  requests,
  disabled,
  stop,
}: {
  apps: number;
  requests: number;
  disabled: boolean;
  stop: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = (button: HTMLButtonElement) => {
    setOpen(false);
    void keepRemoteActionFocus(button, 'remote-mcp-check', stop);
  };
  return (
    <>
      <Button
        ref={trigger}
        variant="destructive"
        size="sm"
        disabled={disabled}
        onClick={(event) =>
          apps || requests
            ? setOpen(true)
            : void keepRemoteActionFocus(event.currentTarget, 'remote-mcp-check', stop)
        }
      >
        Stop remote connection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          initialFocus={cancel}
          finalFocus={trigger}
          showCloseButton={false}
          className="modal remote-mcp-stop-dialog"
        >
          <DialogTitle>
            {apps
              ? `Stop and disconnect ${apps} ${apps === 1 ? 'app' : 'apps'}?`
              : 'Stop and cancel pending connections?'}
          </DialogTitle>
          <DialogDescription>
            {requests
              ? `${requests} waiting ${requests === 1 ? 'request will' : 'requests will'} also be cancelled. `
              : ''}
            This address will stop working. The next address will be different; send Grok Bot a new
            message to try again. Work already queued can continue.
          </DialogDescription>
          <DialogFooter>
            <Button ref={cancel} variant="outline" onClick={() => setOpen(false)}>
              Keep connection
            </Button>
            <Button variant="destructive" onClick={(event) => confirm(event.currentTarget)}>
              {apps ? 'Stop and disconnect' : 'Stop and cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
