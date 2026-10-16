import { Search } from 'lucide-react';
import type { ProfileImportFile } from '@pitchcrew/core';
import { Input } from '@/components/ui/input/components/Input.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { ImportReviewProps } from '../types.ts';

export function ImportReviewToolbar({
  changes,
  query,
  setQuery,
  unchanged,
  selected,
  setSelected,
  busy,
}: Pick<ImportReviewProps, 'selected' | 'setSelected' | 'busy'> & {
  changes: ProfileImportFile[];
  query: string;
  setQuery: (value: string) => void;
  unchanged: number;
}) {
  const safe = changes.filter((file) => file.status !== 'conflict');
  return (
    <div className="shrink-0 border-b border-border px-5 py-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search document changes"
          placeholder="Search filenames or folders…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <output className="text-caption text-muted-foreground" aria-live="polite">
          {selected.length} of {changes.length} selected
          {unchanged ? ` · ${unchanged} unchanged hidden` : ''}
        </output>
        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !safe.length}
            onClick={() => setSelected(safe.map((file) => file.name))}
          >
            Select without local edits
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !selected.length}
            onClick={() => setSelected([])}
          >
            Clear
          </Button>
        </div>
      </div>
      {query.trim() && selected.length ? (
        <p className="mt-1 text-caption text-muted-foreground">
          Selections are kept when searching. Import includes all selected documents.
        </p>
      ) : null}
    </div>
  );
}
