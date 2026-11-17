import { Download, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { AttachmentPager } from './AttachmentPager.tsx';
import { ViewerTitle } from './ViewerTitle.tsx';
import { ViewControls } from './ViewControls.tsx';
import { downloadNoticeId } from './ViewerNotice.tsx';

/**
 * The viewer's single toolbar: attachment pager, filename, view controls, then file actions.
 * Narrow dialogs drop the facts and labels first; phones split it into two rows.
 */
export const ViewerToolbar = ({ model, close }: { model: FileViewerModel; close: () => void }) => (
  <header className="file-toolbar">
    <AttachmentPager model={model} />
    <ViewerTitle model={model} />
    <ViewControls model={model} />
    <div className="file-toolbar-actions">
      <Button
        size="sm"
        variant="ghost"
        className="file-download"
        aria-label={`Download ${model.file.name}`}
        aria-describedby={model.file.downloadAllowed ? undefined : downloadNoticeId(model)}
        title={model.file.downloadAllowed ? `Download ${model.file.name}` : undefined}
        disabled={!model.file.downloadAllowed}
        focusableWhenDisabled
        onClick={model.download}
      >
        <Download size={16} />
        <span className="file-download-label">Download</span>
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="file-expand"
        aria-label={model.expanded ? 'Restore viewer' : 'Expand viewer'}
        title={model.expanded ? 'Restore viewer' : 'Expand viewer'}
        onClick={model.toggleExpanded}
      >
        {model.expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Close viewer"
        title="Close (Esc)"
        onClick={close}
      >
        <X size={18} />
      </Button>
    </div>
  </header>
);
