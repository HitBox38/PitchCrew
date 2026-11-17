import { useRef, useState } from 'react';
import { FileViewer } from '../index.tsx';
import { fileFacts, fileFormat } from '../attachments.ts';
import type { ViewerFile } from '../types.ts';
import { notesLabel } from '@/lib/document-findings.ts';

/** Exact files as paper tiles; each opens the read-only viewer and returns focus to its tile. */
export const AttachmentList = ({ files }: { files: ViewerFile[] }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const tiles = useRef<HTMLUListElement>(null);
  return (
    <>
      <ul className="file-tiles" ref={tiles} aria-label={`${files.length} attachments`}>
        {files.map((file, index) => (
          <li key={file.id}>
            <button
              type="button"
              className="file-tile"
              data-file={index}
              data-kind={file.kind}
              onClick={() => setSelected(index)}
            >
              <span className="file-tile-sheet" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="file-tile-name">
                <strong>{file.name}</strong>
                <small>{fileFormat(file)}</small>
              </span>
              <small className="file-tile-facts">{fileFacts(file)}</small>
              {file.findings?.length ? (
                <small
                  className="file-tile-notes"
                  data-severity={
                    file.findings.some((finding) => finding.severity === 'error')
                      ? 'error'
                      : undefined
                  }
                >
                  {notesLabel(file.findings)}
                </small>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {selected !== null ? (
        <FileViewer
          files={files}
          initialIndex={selected}
          description="Read-only attachment viewer. Viewing a file does not approve the request or export it."
          close={(previous) => {
            setSelected(null);
            requestAnimationFrame(() =>
              tiles.current?.querySelector<HTMLButtonElement>(`[data-file="${previous}"]`)?.focus(),
            );
          }}
        />
      ) : null}
    </>
  );
};
