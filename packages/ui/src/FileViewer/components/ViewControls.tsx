import { Search } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { ZoomControls } from './ZoomControls.tsx';
import { ModeSegment } from './ModeSegment.tsx';
import { ViewerMoreControls } from './ViewerMoreControls.tsx';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { modKey } from '@/shortcuts.ts';

/** Find, zoom, the Rendered/Source segment and More: the view controls for the current file. */
export const ViewControls = ({ model }: { model: FileViewerModel }) => {
  const { file, findOpen, searchable, attachFindTrigger, openFind, closeFind } = model;
  return (
    <fieldset className="file-toolbar-tools" aria-label="View">
      {file.kind !== 'image' ? (
        <Button
          ref={attachFindTrigger}
          size="icon-sm"
          variant="ghost"
          aria-label="Find"
          aria-pressed={findOpen}
          title={searchable === false ? 'This PDF has no searchable text' : `Find (${modKey}F)`}
          onClick={findOpen ? closeFind : openFind}
          disabled={searchable === false}
        >
          <Search size={16} />
        </Button>
      ) : null}
      <ZoomControls model={model} />
      <ModeSegment model={model} />
      <ViewerMoreControls model={model} />
    </fieldset>
  );
};
