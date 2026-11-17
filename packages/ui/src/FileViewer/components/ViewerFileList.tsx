import { FileImage, FileText } from 'lucide-react';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { fileFormat } from '../attachments.ts';
import { FileName } from './FileName.tsx';
import { notesLabel } from '@/lib/document-findings.ts';

/** Every attachment of the request in one quiet column beside the reader, when there are several. */
export const ViewerFileList = ({ model }: { model: FileViewerModel }) =>
  model.files.length > 1 ? (
    <nav className="file-view-list" aria-label="Attachments">
      {model.files.map((file, position) => {
        const Glyph = file.kind === 'image' ? FileImage : FileText;
        const severity = file.findings?.some((finding) => finding.severity === 'error')
          ? 'error'
          : file.findings?.length
            ? 'warning'
            : undefined;
        const label = notesLabel(file.findings ?? []);
        return (
          <button
            key={file.id}
            type="button"
            aria-current={position === model.index ? 'true' : undefined}
            onClick={() => model.move(position)}
          >
            <Glyph size={15} aria-hidden="true" />
            <FileName name={file.name} />
            <small>{fileFormat(file)}</small>
            {severity ? (
              <>
                <i
                  className="file-note-dot"
                  data-severity={severity}
                  aria-hidden="true"
                  title={label}
                />
                <span className="sr-only">, {label}</span>
              </>
            ) : null}
          </button>
        );
      })}
    </nav>
  ) : null;
