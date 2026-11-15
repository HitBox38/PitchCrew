import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
import { noteLabel } from '../helpers.ts';

/**
 * Deleting moves the note to Pitchcrew's trash, with Undo in the explorer. The dialog names what
 * else depends on it: packets that quote it, and the source that would offer it again.
 */
export const ProfileDeleteDialog = ({
  name,
  cited,
  source,
  unsaved,
  close,
  remove,
}: {
  name: string;
  cited: number;
  source: string;
  unsaved: boolean;
  close: () => void;
  remove: () => Promise<unknown>;
}) => {
  const [busy, setBusy] = useState(false);
  const consequences = [
    cited
      ? `${cited} ${cited === 1 ? 'packet quotes' : 'packets quote'} this note. ${cited === 1 ? 'It' : 'They'} will need a new draft before export.`
      : '',
    source ? `It came from ${source}; the next refresh of that source offers it again.` : '',
    unsaved ? 'Your unsaved changes to it are discarded.' : '',
  ].filter(Boolean);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="modal profile-small-dialog">
        <DialogHeader>
          <DialogTitle>Delete {noteLabel(name)}?</DialogTitle>
          <DialogDescription>
            You can undo right after deleting, and Recently deleted (in the notes ⋯ menu) keeps it
            for 30 days.
          </DialogDescription>
        </DialogHeader>
        {consequences.length ? (
          <ul className="profile-delete-consequences">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void remove().finally(close);
            }}
          >
            {busy ? 'Deleting…' : 'Delete note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
