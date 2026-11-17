import { CircleAlert, FileWarning, Info, Lock } from 'lucide-react';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { ViewerFindings } from './ViewerFindings.tsx';
import { wordLayoutNotice } from '@/lib/document-findings.ts';

export const downloadNoticeId = (model: Pick<FileViewerModel, 'id'>) => `${model.id}-download`;

/**
 * What the reader should know about this file, under the document: why Download is locked, Word
 * layout and unsearchable-PDF caveats, errors and the file's layout notes. Absent when empty.
 */
export const ViewerNotice = ({ model }: { model: FileViewerModel }) => {
  const { file, settings, searchable, error } = model;
  const lines = [
    !file.downloadAllowed && {
      key: 'download',
      icon: Lock,
      id: downloadNoticeId(model),
      text: 'Download becomes available after approving the packet and choosing how to submit from the request.',
    },
    file.kind === 'docx' &&
      settings.mode === 'rendered' && {
        key: 'docx',
        icon: Info,
        text: wordLayoutNotice,
      },
    file.kind === 'pdf' &&
      searchable === false && {
        key: 'text',
        icon: FileWarning,
        text: 'This PDF has no extractable text. Search and text selection are unavailable; no OCR has been performed.',
      },
  ].filter((line) => !!line);
  if (!lines.length && !error && !file.findings?.length) return null;
  return (
    <footer className="file-view-notice">
      {error ? (
        <p role="alert" className="file-view-notice-error">
          <CircleAlert size={15} aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {lines.map(({ key, icon: Icon, id, text }) => (
        <p key={key} id={id}>
          <Icon size={15} aria-hidden="true" />
          {text}
        </p>
      ))}
      <ViewerFindings file={file} />
    </footer>
  );
};
