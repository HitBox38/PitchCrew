import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@pitchcrew/design-system/dialog';
import { Button } from '@pitchcrew/design-system/button';
import { ProfileNameField } from './ProfileNameField.tsx';

/**
 * One name field: a folder's name, or a note's filename without its `.md` (shown beside the
 * field and added on submit, so typing "work.md" or "work" both give work.md).
 */
export const ProfileRenameDialog = ({
  title,
  description,
  label,
  current,
  suffix = '',
  problem: check,
  submitLabel = 'Rename',
  hint,
  close,
  submit,
}: {
  title: string;
  description: string;
  label: string;
  current: string;
  suffix?: string;
  problem: (name: string) => string;
  submitLabel?: string;
  /** A line under the field about what the name becomes, such as the filename. */
  hint?: (name: string) => string;
  close: () => void;
  submit: (name: string) => Promise<unknown> | void;
}) => {
  const strip = (value: string) =>
    suffix && value.toLowerCase().endsWith(suffix) ? value.slice(0, -suffix.length) : value;
  const [name, setName] = useState(strip(current));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const next = `${strip(name.trim())}${suffix}`;
    if (next === current) return close();
    const issue = check(next);
    setProblem(issue);
    if (issue) return;
    setBusy(true);
    await submit(next);
    setBusy(false);
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent className="modal profile-small-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="ui-field-group" onSubmit={(event) => void save(event)}>
          <label className="profile-dialog-field">
            {label}
            <ProfileNameField value={name} onChange={setName} suffix={suffix} invalid={!!problem} />
          </label>
          {hint?.(name) ? (
            <p className="profile-dialog-note">
              Saved as <code>{hint(name)}</code>
            </p>
          ) : null}
          {problem ? (
            <p className="form-error" role="alert">
              {problem}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !strip(name.trim())}>
              {busy ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
