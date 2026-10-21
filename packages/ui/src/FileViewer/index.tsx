import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog/index.tsx';
import { useFileViewer } from './hooks/useFileViewer.ts';
import { ViewerToolbar } from './components/ViewerToolbar.tsx';
import { ViewControls } from './components/ViewControls.tsx';
import { ViewerBody } from './components/ViewerBody.tsx';
import { FindBar } from './components/FindBar.tsx';
import { ViewerFindings } from './components/ViewerFindings.tsx';
import type { ViewerFile } from './types.ts';
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
        onKeyDownCapture={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === 'f' &&
            model.file.kind !== 'image'
          ) {
            event.preventDefault();
            model.openFind();
          }
          if (event.key === 'Escape' && model.findOpen) {
            event.preventDefault();
            event.stopPropagation();
            model.setFindOpen(false);
          }
          if (
            (event.metaKey || event.ctrlKey) &&
            !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)
          ) {
            if (['+', '=', '-'].includes(event.key)) {
              event.preventDefault();
              model.change({
                zoom: Math.max(
                  25,
                  Math.min(400, model.settings.zoom + (event.key === '-' ? -25 : 25)),
                ),
              });
            }
            if (event.key === '0') {
              event.preventDefault();
              model.change({ zoom: 100, fit: 'actual' });
            }
          }
        }}
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
        <ViewerBody key={model.file.id} model={model} />
      </DialogContent>
    </Dialog>
  );
};
