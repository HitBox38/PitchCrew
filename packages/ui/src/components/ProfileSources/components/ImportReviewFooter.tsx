import { Button } from '@/components/ui/button/components/Button.tsx';
import { SourceProgress } from './SourceProgress.tsx';
import type { ProfileSourcesModel } from '../types.ts';

export function ImportReviewFooter(c: ProfileSourcesModel) {
  return (
    <div className="profile-import-footer form-footer">
      {c.progress ? <SourceProgress label={c.progress.label} /> : null}
      <Button className="button" disabled={c.busy} onClick={() => c.setPreview(null)}>
        Cancel
      </Button>
      <Button
        className="button primary"
        disabled={c.busy || !c.selected.length}
        onClick={c.importSelected}
      >
        {c.progress
          ? 'Importing…'
          : `Import ${c.selected.length} ${c.selected.length === 1 ? 'document' : 'documents'}`}
      </Button>
    </div>
  );
}
