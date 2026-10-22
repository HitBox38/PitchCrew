import { useRef, useState } from 'react';
import { FileText, File, Image, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { FileViewer } from '../index.tsx';
import { fileSize } from '../attachments.ts';
import type { ViewerFile } from '../types.ts';
export const AttachmentList = ({ files }: { files: ViewerFile[] }) => {
  const [selected, setSelected] = useState<number | null>(null);
  const tiles = useRef<HTMLDivElement>(null);
  return (
    <section className="mail-attachments" aria-label="Request attachments">
      <h3>
        <Paperclip size={16} />
        {files.length} attachments
      </h3>
      <div className="attachment-tiles" ref={tiles}>
        {files.map((file, index) => (
          <Button
            key={file.id}
            variant="outline"
            className="attachment-tile"
            data-file={index}
            onClick={() => setSelected(index)}
          >
            <span className="attachment-format" data-kind={file.kind}>
              {file.kind === 'image' ? (
                <Image size={23} />
              ) : file.kind === 'pdf' ? (
                <File size={23} />
              ) : (
                <FileText size={23} />
              )}
            </span>
            <span>
              <strong>{file.name}</strong>
              <small>
                {file.kind === 'markdown' ? 'Markdown' : file.kind.toUpperCase()} · {fileSize(file)}
                {file.pages
                  ? ` · ${file.pages} ${file.kind === 'docx' ? 'estimated ' : ''}page${file.pages === 1 ? '' : 's'}`
                  : ''}
              </small>
              {file.findings?.length ? (
                <small className="text-ochre">
                  {file.findings.length} layout note{file.findings.length === 1 ? '' : 's'}
                </small>
              ) : null}
            </span>
          </Button>
        ))}
      </div>
      {selected !== null ? (
        <FileViewer
          files={files}
          initialIndex={selected}
          close={(previous) => {
            setSelected(null);
            requestAnimationFrame(() =>
              tiles.current?.querySelector<HTMLButtonElement>(`[data-file="${previous}"]`)?.focus(),
            );
          }}
        />
      ) : null}
    </section>
  );
};
