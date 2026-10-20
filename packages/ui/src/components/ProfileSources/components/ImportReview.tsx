import { useState } from 'react';
import { Modal } from '@/components/Modal/index.tsx';
import { importChanges } from '../helpers.ts';
import { ImportReviewToolbar } from './ImportReviewToolbar.tsx';
import { ImportReviewList } from './ImportReviewList.tsx';
import { ImportReviewFooter } from './ImportReviewFooter.tsx';
import type { ImportReviewProps } from '../types.ts';

export const ImportReview = (c: ImportReviewProps) => {
  if (!c.preview) return null;
  return <ImportReviewContent key={c.preview.token} {...c} />;
};

const ImportReviewContent = (c: ImportReviewProps) => {
  const [query, setQuery] = useState('');
  const preview = c.preview!;
  const changes = importChanges(preview.files);
  const conflicts = changes.filter(
    (file) => file.status === 'conflict' && c.selected.includes(file.name),
  ).length;
  const close = c.closeReview;
  return (
    <Modal title="Review profile documents" drawer className="profile-import-panel" onClose={close}>
      <div className="shrink-0 border-b border-border px-5 py-4">
        <p className="truncate text-sm font-semibold" title={preview.source.label}>
          {preview.source.label}
        </p>
        <p className="mt-1 text-label text-muted-foreground">
          Review what will change. Selected documents become local evidence your crew can cite.
        </p>
        <p className="mt-1 text-caption text-muted-foreground">
          Confirm the facts describe you. Document instructions do not change crew rules.
        </p>
      </div>
      <ImportReviewToolbar
        {...c}
        changes={changes}
        query={query}
        setQuery={setQuery}
        unchanged={preview.files.length - changes.length}
      />
      <ImportReviewList
        changes={changes}
        missing={preview.missing}
        selected={c.selected}
        toggle={c.toggle}
        busy={c.busy}
        query={query}
      />
      <ImportReviewFooter {...c} conflicts={conflicts} close={close} />
    </Modal>
  );
};
