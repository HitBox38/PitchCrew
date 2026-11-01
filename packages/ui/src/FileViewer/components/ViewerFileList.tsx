import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { fileFormat } from '../attachments.ts';

/** Every attachment of the request beside the reader, when there is more than one. */
export const ViewerFileList = ({ model }: { model: FileViewerModel }) =>
  model.files.length > 1 ? (
    <nav className="file-view-list" aria-label="Attachments">
      {model.files.map((file, position) => (
        <button
          key={file.id}
          type="button"
          aria-current={position === model.index ? 'true' : undefined}
          onClick={() => model.move(position)}
        >
          <span>{file.name}</span>
          <small>{fileFormat(file)}</small>
        </button>
      ))}
    </nav>
  ) : null;
