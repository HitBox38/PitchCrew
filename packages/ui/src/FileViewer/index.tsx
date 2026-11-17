import { Dialog, DialogContent, DialogDescription } from '@pitchcrew/design-system/dialog';
import { useFileViewer } from './hooks/useFileViewer.ts';
import { ViewerToolbar } from './components/ViewerToolbar.tsx';
import { ViewerStage } from './components/ViewerStage.tsx';
import { ViewerNotice } from './components/ViewerNotice.tsx';
import { ViewerFileList } from './components/ViewerFileList.tsx';
import type { ViewerFile } from './types.ts';
import { viewerKeyDown } from './hooks/viewerKeys.ts';
import '@/styles/file-viewer.css';
export const FileViewer = ({
  files,
  initialIndex,
  close,
  description = 'Read-only file viewer.',
}: {
  files: ViewerFile[];
  initialIndex: number;
  close: (index: number) => void;
  /** What the viewer is for here: request attachments say the decision waits outside it. */
  description?: string;
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
        data-expanded={model.expanded}
        data-kind={model.file.kind}
        data-files={files.length > 1 ? 'many' : 'one'}
        data-thumbnails={model.file.kind === 'pdf' && model.settings.thumbnails ? '' : undefined}
        showCloseButton={false}
        initialFocus={model.initialFocus}
        onKeyDownCapture={viewerKeyDown(model)}
      >
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <ViewerToolbar model={model} close={() => close(model.index)} />
        <div className="file-view-main">
          <ViewerFileList model={model} />
          <ViewerStage model={model} />
        </div>
        <ViewerNotice model={model} />
      </DialogContent>
    </Dialog>
  );
};
