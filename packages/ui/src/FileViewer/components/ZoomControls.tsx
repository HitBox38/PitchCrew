import { Minus, Plus } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { maxZoom, minZoom } from '../zoom.ts';
import { ZoomMenu } from './ZoomMenu.tsx';
import { modKey } from '@/shortcuts.ts';

/** − / + around the zoom menu, which is the single percentage on screen. */
export const ZoomControls = ({ model }: { model: FileViewerModel }) => (
  <fieldset className="file-zoom-controls" aria-label="Document zoom">
    <Button
      size="icon-sm"
      variant="ghost"
      className="file-zoom-step"
      aria-label="Zoom out"
      title={`Zoom out (${modKey}−)`}
      disabled={model.zoom.shown <= minZoom}
      onClick={() => model.zoom.zoomBy(-1)}
    >
      <Minus size={16} />
    </Button>
    <ZoomMenu model={model} />
    <Button
      size="icon-sm"
      variant="ghost"
      className="file-zoom-step"
      aria-label="Zoom in"
      title={`Zoom in (${modKey}+)`}
      disabled={model.zoom.shown >= maxZoom}
      onClick={() => model.zoom.zoomBy(1)}
    >
      <Plus size={16} />
    </Button>
  </fieldset>
);
