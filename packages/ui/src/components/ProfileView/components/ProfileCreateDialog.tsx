import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { Input } from '@pitchcrew/design-system/input';
import { Button } from '@pitchcrew/design-system/button';
import { FormSelect } from '@/FormSelect/index.tsx';
import { filenameFor } from '../helpers.ts';

/** Names a new note before it opens, so the explorer never fills with "new-note-3.md". */
export const ProfileCreateDialog = ({
  folder: initialFolder,
  folders,
  taken,
  close,
  create,
}: {
  folder: string;
  folders: string[];
  taken: string[];
  close: () => void;
  create: (title: string, folder: string) => Promise<boolean>;
}) => {
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState(initialFolder);
  const [busy, setBusy] = useState(false);
  const filename = filenameFor(title, taken);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!title.trim() || busy) return;
    setBusy(true);
    if (!(await create(title, folder))) setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="modal profile-small-dialog">
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>
            One topic per note works best: a role, a project, your skills. Your crew can quote it.
          </DialogDescription>
        </DialogHeader>
        <form className="ui-field-group" onSubmit={(event) => void submit(event)}>
          <label className="profile-dialog-field">
            Name
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Work history"
              autoComplete="off"
              maxLength={80}
              required
            />
          </label>
          <FormSelect
            label="Folder"
            value={folder}
            onValueChange={setFolder}
            options={folders.map((path) => ({ value: path, label: path || 'Profile (top level)' }))}
          />
          {title.trim() ? (
            <p className="profile-dialog-note">
              Saved as <code>{filename}</code>
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Creating…' : 'Create note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
