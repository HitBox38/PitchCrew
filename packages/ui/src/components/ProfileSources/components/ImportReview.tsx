import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ImportDocument } from './ImportDocument.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function ImportReview(c: ProfileSourcesModel) {
  if (!c.preview) return null;
  const conflicts = c.preview.files.filter(
    (file) => file.status === 'conflict' && c.selected.includes(file.name),
  ).length;
  return (
    <Modal
      title="Review profile documents"
      drawer
      className="profile-import-panel"
      onClose={() => {
        if (!c.busy) c.setPreview(null);
      }}
    >
      <div className="profile-import-review">
        <p className="quiet">{c.preview.source.label}</p>
        <p>
          Confirm these documents describe you. Selected documents become local evidence your crew
          can cite.
        </p>
        <p className="quiet">
          Source content is copied exactly. Instructions in documents do not change crew rules.
          Refresh is always reviewed here.
        </p>
        <div className="profile-import-selection">
          <Button
            variant="ghost"
            className="text-button min-h-8"
            disabled={c.busy}
            onClick={() =>
              c.setSelected(
                c
                  .preview!.files.filter((file) => file.status !== 'conflict')
                  .map((file) => file.name),
              )
            }
          >
            Select all without local edits
          </Button>
          <Button
            variant="ghost"
            className="text-button min-h-8"
            disabled={c.busy}
            onClick={() => c.setSelected([])}
          >
            Clear selection
          </Button>
          <span>
            {c.selected.length} of {c.preview.files.length} selected
          </span>
        </div>
        <div className="profile-import-documents">
          {c.preview.files.map((file) => (
            <ImportDocument
              key={file.name}
              file={file}
              selected={c.selected.includes(file.name)}
              toggle={c.toggle}
              busy={c.busy}
            />
          ))}
        </div>
        {c.preview.missing.length ? (
          <p className="info-note">
            No longer in the source; local copies will be kept: {c.preview.missing.join(', ')}
          </p>
        ) : null}
        {conflicts ? (
          <p className="form-error">
            Importing will replace local edits in {conflicts} selected documents. Clear those
            selections to keep your edits.
          </p>
        ) : null}
        {c.error ? (
          <p className="form-error" role="alert">
            {c.error}
          </p>
        ) : null}
      </div>
      <div className="profile-import-footer form-footer">
        <Button className="button" disabled={c.busy} onClick={() => c.setPreview(null)}>
          Cancel
        </Button>
        <Button
          className="button primary"
          disabled={c.busy || !c.selected.length}
          onClick={c.importSelected}
        >
          {c.busy ? 'Importing…' : `Import ${c.selected.length} documents`}
        </Button>
      </div>
    </Modal>
  );
}
