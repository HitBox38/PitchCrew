import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ImportReviewProps } from '../types.ts';

export function ImportReviewFooter({
  selected,
  busy,
  error,
  importSelected,
  conflicts,
  close,
}: Pick<ImportReviewProps, 'selected' | 'busy' | 'error' | 'importSelected'> & {
  conflicts: number;
  close: () => void;
}) {
  return (
    <div className="profile-import-footer">
      {conflicts ? (
        <output className="mb-3 block text-label text-ochre">
          Importing replaces local edits in {conflicts} selected{' '}
          {conflicts === 1 ? 'document' : 'documents'}. Deselect {conflicts === 1 ? 'it' : 'them'}{' '}
          to keep your edits.
        </output>
      ) : null}
      {error ? (
        <p className="form-error mb-3" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={close}>
          Cancel
        </Button>
        <Button className="primary" disabled={busy || !selected.length} onClick={importSelected}>
          {busy
            ? 'Importing…'
            : `Import ${selected.length} ${selected.length === 1 ? 'document' : 'documents'}`}
        </Button>
      </div>
    </div>
  );
}
