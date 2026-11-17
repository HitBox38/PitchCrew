import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';

/**
 * PDF page navigation floating at the bottom of the reading area, for PDFs with several pages.
 * The page field keeps what the reader types until Enter or leaving it, so scrolling cannot
 * overwrite a half-typed number.
 */
export const PagePill = ({ model }: { model: FileViewerModel }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const { pages, visiblePage, change } = model;
  if (model.file.kind !== 'pdf' || pages < 2) return null;
  const commit = () => {
    const value = Number(draft);
    if (Number.isInteger(value) && value >= 1 && value <= pages) change({ page: value });
    setDraft(null);
  };
  return (
    <nav className="file-page-pill" aria-label="PDF pages">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Previous page"
        title="Previous page"
        disabled={visiblePage <= 1}
        onClick={() => change({ page: visiblePage - 1 })}
      >
        <ChevronLeft size={16} />
      </Button>
      <label>
        <span className="sr-only">Page</span>
        <input
          aria-label="Page number"
          aria-describedby={`${model.id}-page-total`}
          data-draft={draft === null ? undefined : ''}
          inputMode="numeric"
          value={draft ?? String(visiblePage)}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            // Escape drops a half-typed page number before it can close the viewer.
            if (event.key === 'Escape' && draft !== null) {
              event.preventDefault();
              event.stopPropagation();
              setDraft(null);
            }
          }}
        />
        <span id={`${model.id}-page-total`}>of {pages}</span>
      </label>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Next page"
        title="Next page"
        disabled={visiblePage >= pages}
        onClick={() => change({ page: visiblePage + 1 })}
      >
        <ChevronRight size={16} />
      </Button>
    </nav>
  );
};
