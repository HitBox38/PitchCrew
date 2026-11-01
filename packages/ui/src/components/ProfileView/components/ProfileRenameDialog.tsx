import { useState, type FormEvent } from 'react';
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
import { filenameProblem } from '../helpers.ts';

/** Drafts a filename on the note's tab; Save writes the note under it. */
export const ProfileRenameDialog = ({
  current,
  taken,
  close,
  submit,
}: {
  current: string;
  taken: string[];
  close: () => void;
  submit: (name: string) => void;
}) => {
  const [name, setName] = useState(current);
  const [problem, setProblem] = useState('');
  const save = (event: FormEvent) => {
    event.preventDefault();
    const next = name.trim();
    const issue = filenameProblem(next, taken);
    setProblem(issue);
    if (!issue) submit(next);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="modal profile-small-dialog">
        <DialogHeader>
          <DialogTitle>Change filename</DialogTitle>
          <DialogDescription>
            Saving writes the note under the new filename. The file with the old name stays in your
            profile folder.
          </DialogDescription>
        </DialogHeader>
        <form className="ui-field-group" onSubmit={save}>
          <label className="profile-dialog-field">
            Filename
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              required
              className="font-mono"
            />
          </label>
          {problem ? (
            <p className="form-error" role="alert">
              {problem}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Use filename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
