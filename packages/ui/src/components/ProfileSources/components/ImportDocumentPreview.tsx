import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { ProfileImportFile } from '@pitchcrew/core';
import { InstructionDiff } from '@/components/InstructionUpdate/components/InstructionDiff.tsx';
import { diffCounts, diffInstructions } from '@/components/InstructionUpdate/helpers.ts';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function ImportDocumentPreview({ file }: { file: ProfileImportFile }) {
  const [full, setFull] = useState(false);
  const lines = useMemo(
    () => diffInstructions(file.before ?? '', file.content),
    [file.before, file.content],
  );
  const counts = diffCounts(lines);
  return (
    <div className="profile-import-preview">
      {file.status === 'conflict' ? (
        <p className="mb-3 text-label text-ochre">
          Importing this document replaces your local edits. Compare your saved copy below before
          selecting it.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-muted-foreground">
          {file.before === null ? 'New local document' : 'Saved local copy → Incoming source'}
        </p>
        <fieldset className="flex gap-1" aria-label={`View ${file.path}`}>
          <Button variant="ghost" size="sm" aria-pressed={!full} onClick={() => setFull(false)}>
            Changes
          </Button>
          <Button variant="ghost" size="sm" aria-pressed={full} onClick={() => setFull(true)}>
            Full document
          </Button>
        </fieldset>
      </div>
      {full ? (
        <SourceBlock label={file.path} value={file.content} contentClassName="font-sans" />
      ) : (
        <>
          <p className="my-2 text-caption text-muted-foreground">
            <span className="text-moss">+{counts.added} added</span>
            {' · '}
            <span className="text-rose">−{counts.removed} removed</span> paragraphs
          </p>
          {!counts.added && !counts.removed ? (
            <p className="mb-2 text-label text-muted-foreground">
              No paragraph changes. View the full document to read the exact incoming text.
            </p>
          ) : null}
          <InstructionDiff lines={lines} />
        </>
      )}
      <a
        href={file.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-label text-primary underline underline-offset-4"
      >
        Open original source <ExternalLink size={12} aria-hidden="true" />
      </a>
      <span className="sr-only">Saved as {file.name}</span>
    </div>
  );
}
