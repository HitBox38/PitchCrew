import { FormSelect } from '@/FormSelect/index.tsx';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
/** The preset menu shows the current percentage, so it is the only percentage on screen. */
export const ZoomControls = ({
  settings,
  change,
}: Pick<FileViewerModel, 'settings' | 'change'>) => (
  <fieldset className="file-zoom-controls" aria-label="Document zoom">
    <Button
      size="icon"
      variant="ghost"
      aria-label="Zoom out"
      disabled={settings.zoom <= 25}
      onClick={() => change({ zoom: Math.max(25, settings.zoom - 25) })}
    >
      <Minus size={16} />
    </Button>
    <FormSelect
      label="Zoom preset"
      value={String(settings.zoom)}
      onValueChange={(value) => change({ zoom: Number(value) })}
      options={[...new Set([25, 50, 75, 100, 125, 150, 200, 300, 400, settings.zoom])]
        .sort((a, b) => a - b)
        .map((value) => ({ value: String(value), label: `${value}%` }))}
    />
    <Button
      size="icon"
      variant="ghost"
      aria-label="Zoom in"
      disabled={settings.zoom >= 400}
      onClick={() => change({ zoom: Math.min(400, settings.zoom + 25) })}
    >
      <Plus size={16} />
    </Button>
    <Button
      size="sm"
      variant="ghost"
      disabled={settings.zoom === 100 && settings.fit === 'actual'}
      onClick={() => change({ zoom: 100, fit: 'actual' })}
    >
      Reset zoom
    </Button>
  </fieldset>
);
