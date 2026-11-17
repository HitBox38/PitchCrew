import { FileImage, FileText } from 'lucide-react';
import { DialogTitle } from '@pitchcrew/design-system/dialog';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { fileFormat } from '../attachments.ts';
import { FileName } from './FileName.tsx';

/** The exact filename as the dialog's name, with its format and page count as quiet facts. */
export const ViewerTitle = ({ model }: { model: FileViewerModel }) => {
  const { file, files, index, pages } = model;
  const Glyph = file.kind === 'image' ? FileImage : FileText;
  const count = pages || file.pages;
  return (
    <div className="file-toolbar-title">
      <Glyph size={17} aria-hidden="true" className="file-toolbar-glyph" />
      <div className="file-toolbar-name">
        <DialogTitle>
          <FileName name={file.name} />
        </DialogTitle>
        <p className="file-toolbar-facts">
          {files.length > 1 ? (
            <span className="file-toolbar-position">
              {index + 1} of {files.length} ·{' '}
            </span>
          ) : null}
          {fileFormat(file)}
          {count
            ? ` · ${file.kind === 'docx' ? 'about ' : ''}${count} page${count === 1 ? '' : 's'}`
            : ''}
        </p>
      </div>
    </div>
  );
};
