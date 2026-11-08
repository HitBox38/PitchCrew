import { Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';

/** Page zoom as one menu row; pending commands disable the buttons but keep their focus. */
export const NativeBrowserZoom = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const zoom = model.state?.tabs.find((tab) => tab.id === model.state?.activeTab)?.zoomFactor ?? 1;
  const setZoom = (factor: number) => void model.command({ kind: 'zoom', factor });
  return (
    <fieldset className="browser-menu-zoom" aria-label="Page zoom">
      <span className="browser-menu-zoom-label">Zoom</span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Zoom out"
        title="Zoom out (Ctrl −)"
        focusableWhenDisabled
        disabled={!manual || zoom <= 0.25}
        onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
      >
        <Minus size={14} />
      </Button>
      <output aria-live="polite">{Math.round(zoom * 100)}%</output>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Zoom in"
        title="Zoom in (Ctrl +)"
        focusableWhenDisabled
        disabled={!manual || zoom >= 5}
        onClick={() => setZoom(Math.min(5, zoom + 0.25))}
      >
        <Plus size={14} />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Reset page zoom"
        title="Reset zoom (Ctrl 0)"
        focusableWhenDisabled
        disabled={!manual || zoom === 1}
        onClick={() => setZoom(1)}
      >
        <RotateCcw size={14} />
      </Button>
    </fieldset>
  );
};
