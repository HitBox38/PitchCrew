import { useEffect, useState } from 'react';
import { FileText, Undo2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
import { api } from '@/api.ts';
import { timeAgo } from '@/lib/time.ts';
import { noteLabel } from '../helpers.ts';

interface TrashEntry {
  trashId: string;
  name: string;
  deletedAt: string;
}

/** Notes deleted in the last 30 days, newest first, each one restorable. */
export const ProfileTrashDialog = ({
  close,
  restore,
}: {
  close: () => void;
  restore: (trashId: string) => Promise<boolean>;
}) => {
  const [entries, setEntries] = useState<TrashEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<TrashEntry[]>('/profile/trash').then(setEntries, (failure: Error) =>
      setError(failure.message),
    );
  }, []);
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="modal profile-small-dialog profile-trash-dialog">
        <DialogHeader>
          <DialogTitle>Recently deleted</DialogTitle>
          <DialogDescription>
            Deleted notes stay here for 30 days. Restoring puts a note back where it was.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="form-error">{error}</p> : null}
        {entries && !entries.length ? (
          <p className="ui-empty profile-trash-empty">Nothing deleted in the last 30 days.</p>
        ) : null}
        {entries?.length ? (
          <ul className="profile-trash-list">
            {entries.map((entry) => (
              <li key={entry.trashId}>
                <FileText size={15} aria-hidden="true" />
                <span className="profile-trash-name">{noteLabel(entry.name)}</span>
                <span className="profile-trash-when">{timeAgo(entry.deletedAt)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Restore ${entry.name}`}
                  onClick={() =>
                    void restore(entry.trashId).then((done) => {
                      if (done) setEntries((list) => list?.filter((item) => item !== entry) ?? []);
                    })
                  }
                >
                  <Undo2 aria-hidden="true" /> Restore
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
