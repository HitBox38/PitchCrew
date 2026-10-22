import { ArrowLeft, ArrowRight, Download, Maximize2, Minimize2, X } from 'lucide-react';
import { DialogTitle } from '@/components/ui/dialog/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Input } from '@/components/ui/input/components/Input.tsx';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
export const ViewerToolbar = ({ model, close }: { model: FileViewerModel; close: () => void }) => (
  <>
    <div className="file-dialog-heading">
      <div>
        <DialogTitle>{model.file.name}</DialogTitle>
        <p>
          {model.index + 1} of {model.files.length} attachments · Read-only
        </p>
      </div>
      <div className="file-heading-actions">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Previous attachment"
          disabled={!model.index}
          onClick={() => model.move(model.index - 1)}
        >
          <ArrowLeft size={17} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Next attachment"
          disabled={model.index === model.files.length - 1}
          onClick={() => model.move(model.index + 1)}
        >
          <ArrowRight size={17} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-label={`Download ${model.file.name}`}
          disabled={!model.file.downloadAllowed}
          onClick={model.download}
        >
          <Download size={16} />
          Download
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={model.settings.expanded ? 'Restore viewer' : 'Expand viewer'}
          onClick={() => model.change({ expanded: !model.settings.expanded })}
        >
          {model.settings.expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </Button>
        <Button size="icon" variant="ghost" aria-label="Close attachment" onClick={close}>
          <X size={18} />
        </Button>
      </div>
    </div>
    {model.file.kind === 'pdf' && model.pages > 0 ? (
      <fieldset className="file-page-controls" aria-label="PDF page navigation">
        <Button
          size="sm"
          variant="ghost"
          disabled={model.visiblePage <= 1}
          onClick={() => model.change({ page: model.visiblePage - 1 })}
        >
          Previous page
        </Button>
        <label>
          Page{' '}
          <Input
            type="number"
            aria-label="Page number"
            min={1}
            max={model.pages}
            value={model.visiblePage}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value >= 1 && value <= model.pages) model.change({ page: value });
            }}
          />{' '}
          of {model.pages}
        </label>
        <Button
          size="sm"
          variant="ghost"
          disabled={model.visiblePage >= model.pages}
          onClick={() => model.change({ page: model.visiblePage + 1 })}
        >
          Next page
        </Button>
      </fieldset>
    ) : null}
  </>
);
