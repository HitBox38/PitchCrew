import { useState } from 'react';
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
  const selectedNames = new Set(c.selected);
  const conflicts = changes.filter(
    (file) => file.status === 'conflict' && selectedNames.has(file.name),
  ).length;
  const close = c.closeReview;
  return (
    <>
      <div className="profile-import-source">
        <p className="text-detail text-muted-foreground">
          Selected documents become local evidence your crew can cite once you confirm the facts
          describe you. Document instructions do not change crew rules.
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
    </>
  );
};
