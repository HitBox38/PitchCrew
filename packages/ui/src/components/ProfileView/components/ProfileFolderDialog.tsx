import { useProfileFolderDialog } from '../hooks/useProfileFolderDialog.ts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog/index.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import type { ProfileFolderOperation } from '../types.ts';

export function ProfileFolderDialog({
  operation,
  folders,
  working,
  error,
  close,
  submit,
}: {
  operation: ProfileFolderOperation;
  folders: string[];
  working: boolean;
  error: string;
  close: () => void;
  submit: (folder: string) => Promise<void>;
}) {
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
      <DialogContent className="modal">
        <DialogHeader>
          <DialogTitle>{create ? 'New folder' : 'Move note'}</DialogTitle>
          <DialogDescription>
            {create
              ? 'Create a folder to organize your profile notes.'
              : 'Choose a folder. Your note and its source links stay intact.'}
          </DialogDescription>
        </DialogHeader>
        <form className="form mt-5 grid gap-4" onSubmit={save}>
          {create ? (
            <label>
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
            options={folders.map((path) => ({ value: path, label: path || 'profile (root)' }))}
          />
          {validation || error ? (
            <p className="form-error" role="alert">
              {validation || error}
            </p>
          ) : null}
          <div className="form-footer flex justify-end gap-2 border-t border-border pt-4">
            <Button className="button" disabled={working} onClick={close}>
              Cancel
            </Button>
            <Button
              className="button primary"
              type="submit"
              disabled={working || (create && !name.trim())}
            >
              {working ? 'Saving…' : create ? 'Create folder' : 'Move note'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
