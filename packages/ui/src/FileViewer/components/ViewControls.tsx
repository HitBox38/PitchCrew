import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { ZoomControls } from './ZoomControls.tsx';
import { FormSelect } from '@/FormSelect/index.tsx';
import { ViewerMoreControls } from './ViewerMoreControls.tsx';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
export const ViewControls = (model: FileViewerModel) => {
  const { file, settings, change } = model;
  return (
    <div className="file-view-controls">
      {file.kind !== 'image' ? (
        <Button
          size="sm"
          variant="outline"
          onClick={model.openFind}
          disabled={model.searchable === false}
        >
          <Search size={15} />
          Find
        </Button>
      ) : null}
      <ZoomControls settings={settings} change={change} />
      {['pdf', 'docx', 'image'].includes(file.kind) && settings.mode !== 'source' ? (
        <>
          <FormSelect
            label="Page fit"
            value={settings.fit}
            onValueChange={(fit) => change({ fit, zoom: 100 })}
            options={[
              { value: 'width', label: file.kind === 'image' ? 'Fit image' : 'Fit width' },
              ...(file.kind === 'pdf' ? [{ value: 'page' as const, label: 'Fit page' }] : []),
              { value: 'actual', label: 'Actual size' },
            ]}
          />
        </>
      ) : null}
      {file.kind === 'markdown' || file.kind === 'docx' ? (
        <fieldset aria-label="Document view" className="file-mode-toggle">
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={settings.mode === 'rendered'}
            onClick={() => change({ mode: 'rendered' })}
          >
            {file.kind === 'markdown' ? 'Rendered' : 'Preview'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-pressed={settings.mode === 'source'}
            onClick={() => change({ mode: 'source' })}
          >
            Source
          </Button>
        </fieldset>
      ) : null}
      <ViewerMoreControls model={model} />
    </div>
  );
};
