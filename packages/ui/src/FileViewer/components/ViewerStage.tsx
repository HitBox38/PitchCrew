import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { ViewerBody } from './ViewerBody.tsx';
import { FindBar } from './FindBar.tsx';
import { PagePill } from './PagePill.tsx';

/** Find's scope: the visible view for files with two, otherwise the file itself. */
const findScope = ({ file, settings }: FileViewerModel) =>
  file.kind === 'markdown' || file.kind === 'docx'
    ? settings.mode === 'source'
      ? { scope: 'source', label: 'Source' }
      : {
          scope: 'rendered document',
          label: file.kind === 'markdown' ? 'Rendered' : 'Preview',
        }
    : { scope: file.name, label: undefined };

/**
 * The recessed reading area: the scrolling document with Find and PDF page navigation floating
 * over it. Neither pill scrolls with the document, and the document leaves room for both.
 */
export const ViewerStage = ({ model }: { model: FileViewerModel }) => {
  const finding = model.findOpen && model.file.kind !== 'image' && model.searchable !== false;
  const { scope, label } = findScope(model);
  return (
    <div
      className="file-view-stage"
      data-find={finding ? 'open' : undefined}
      data-paged={model.file.kind === 'pdf' && model.pages > 1 ? '' : undefined}
    >
      <ViewerBody key={model.file.id} model={model} />
      {finding ? (
        <FindBar find={model.find} close={model.closeFind} scope={scope} scopeLabel={label} />
      ) : null}
      <PagePill key={`pages:${model.file.id}`} model={model} />
    </div>
  );
};
