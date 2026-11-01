import { useProfileFolderDialog } from '../hooks/useProfileFolderDialog.ts';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { ProfileFolderChange } from '../types.ts';

export const ProfileFolderDialog = ({
  operation,
  folders,
  working,
  error,
  close,
  submit,
}: {
  operation: ProfileFolderChange;
  folders: string[];
  working: boolean;
  error: string;
  close: () => void;
  submit: (folder: string) => Promise<void>;
}) => {
  const { folder, setFolder, name, setName, validation, create, save } = useProfileFolderDialog(
    operation,
    folders,
    submit,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !working) close();
      }}
    >
      <DialogContent className="modal profile-small-dialog">
        <DialogHeader>
          <DialogTitle>{create ? 'New folder' : 'Move note'}</DialogTitle>
          <DialogDescription>
            {create
              ? 'Folders organize notes in Pitchcrew. Files on disk stay where they are.'
              : 'The note keeps its filename and source link.'}
          </DialogDescription>
        </DialogHeader>
        <form className="ui-field-group" onSubmit={save}>
          {create ? (
            <label className="profile-dialog-field">
              Folder name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                required
                maxLength={80}
                disabled={working}
              />
            </label>
          ) : null}
          <FormSelect
            label={create ? 'Parent folder' : 'Destination folder'}
            value={folder}
            onValueChange={setFolder}
            disabled={working}
            options={folders.map((path) => ({ value: path, label: path || 'Profile (top level)' }))}
          />
          {validation || error ? (
            <p className="form-error" role="alert">
              {validation || error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={working} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={working || (create && !name.trim())}>
              {working ? 'Saving…' : create ? 'Create folder' : 'Move note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
