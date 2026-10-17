import { useState } from 'react';
import { FileMinus2 } from 'lucide-react';
import type { ProfileImportFile } from '@pitchcrew/core';
import { Accordion } from '@/components/ui/accordion/index.tsx';
import { ImportDocument } from './ImportDocument.tsx';

export function ImportReviewList({
  changes,
  missing,
  selected,
  toggle,
  busy,
  query,
}: {
  changes: ProfileImportFile[];
  missing: string[];
  selected: string[];
  toggle: (name: string) => void;
  busy: boolean;
  query: string;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const term = query.trim().toLocaleLowerCase();
  const files = changes.filter((file) =>
    `${file.path}\n${file.name}`.toLocaleLowerCase().includes(term),
  );
  const removed = missing.filter((path) => path.toLocaleLowerCase().includes(term));
  const empty = !files.length && !removed.length;
  return (
    <div className="profile-import-review" aria-label="Document changes">
      {empty ? (
        <output className="block px-4 py-10 text-center">
          <p className="font-semibold">
            {term ? 'No matching changes' : 'Everything is up to date'}
          </p>
          <p className="mt-1 text-label text-muted-foreground">
            {term
              ? 'Try another filename or folder path.'
              : 'There are no document changes to import.'}
          </p>
        </output>
      ) : null}
      <Accordion multiple value={expanded} onValueChange={setExpanded}>
        {files.map((file) => (
          <ImportDocument
            key={file.name}
            file={file}
            selected={selected.includes(file.name)}
            toggle={toggle}
            busy={busy}
            expanded={expanded.includes(file.name)}
          />
        ))}
      </Accordion>
      {removed.map((path) => (
        <div key={path} className="profile-import-removed">
          <FileMinus2
            size={16}
            className="mx-3 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={path}>
            {path}
          </span>
          <span className="text-right text-caption text-muted-foreground">
            Removed from source <span className="block">Local copy kept</span>
          </span>
        </div>
      ))}
    </div>
  );
}
