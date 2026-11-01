import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog/index.tsx';
import { useFileViewer } from './hooks/useFileViewer.ts';
import { ViewerToolbar } from './components/ViewerToolbar.tsx';
import { ViewControls } from './components/ViewControls.tsx';
import { ViewerBody } from './components/ViewerBody.tsx';
import { FindBar } from './components/FindBar.tsx';
import { ViewerFindings } from './components/ViewerFindings.tsx';
import { ViewerFileList } from './components/ViewerFileList.tsx';
import type { ViewerFile } from './types.ts';
import { viewerKeyDown } from './hooks/viewerKeys.ts';
import '@/styles/file-viewer.css';
export const FileViewer = ({
  files,
  initialIndex,
  close,
}: {
  files: ViewerFile[];
  initialIndex: number;
  close: (index: number) => void;
}) => {
  const model = useFileViewer(files, initialIndex, close);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close(model.index);
      }}
    >
      <DialogContent
        className="file-viewer-dialog"
        data-expanded={model.settings.expanded}
        showCloseButton={false}
        onKeyDownCapture={viewerKeyDown(model)}
      >
        <DialogDescription className="sr-only">
          Read-only attachment viewer. Inspect the file, then close to decide on the request.
        </DialogDescription>
        <ViewerToolbar model={model} close={() => close(model.index)} />
        <ViewControls {...model} />
        {model.findOpen && model.file.kind !== 'image' && model.searchable !== false ? (
          <FindBar
            find={model.find}
            close={() => model.setFindOpen(false)}
            scope={
              ['markdown', 'docx'].includes(model.file.kind)
                ? `${model.settings.mode === 'source' ? 'Source' : 'Rendered document'}`
                : model.file.name
            }
          />
        ) : null}
        <ViewerFindings file={model.file} />
        {!model.file.downloadAllowed ? (
          <p className="file-view-note">
            Download becomes available after approving the packet and choosing how to submit from
            the request.
          </p>
        ) : null}
        {model.error ? (
          <p role="alert" className="form-error">
            {model.error}
          </p>
        ) : null}
        <div className="file-view-main">
          <ViewerFileList model={model} />
          <ViewerBody key={model.file.id} model={model} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
