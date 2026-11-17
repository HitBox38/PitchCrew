import { ChevronDown, Minus, Plus, Scan } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';
import type { FileViewerModel } from '../hooks/useFileViewer.ts';
import { zoomPresets, type FitMode } from '../zoom.ts';
import { modKey } from '@/shortcuts.ts';

/**
 * One menu for every size choice: the file kind's fit modes, percentage presets and Reset zoom.
 * The trigger shows the percentage of actual size on screen, whichever mode produced it.
 */
export const ZoomMenu = ({ model }: { model: FileViewerModel }) => {
  const { zoom, settings } = model;
  const fits = zoom.options;
  const custom = !fits.length || zoom.fit === 'actual';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" variant="ghost" className="file-zoom-trigger" />}
        aria-label={`Zoom, ${zoom.shown}%`}
      >
        <span>{zoom.shown}%</span>
        <ChevronDown size={14} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="file-zoom-menu">
        <DropdownMenuGroup>
          <DropdownMenuItem closeOnClick={false} onClick={() => zoom.zoomBy(1)}>
            <Plus size={15} aria-hidden="true" />
            Zoom in
            <DropdownMenuShortcut>{modKey}+</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick={false} onClick={() => zoom.zoomBy(-1)}>
            <Minus size={15} aria-hidden="true" />
            Zoom out
            <DropdownMenuShortcut>{modKey}−</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {fits.length ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Fit</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={custom ? '' : zoom.fit}
              onValueChange={(value) => zoom.setFit(value as FitMode)}
            >
              {fits.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{fits.length ? 'Zoom' : 'Text size'}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={custom ? String(settings.zoom) : ''}
            onValueChange={(value) => zoom.setZoom(Number(value))}
          >
            {zoomPresets.map((value) => (
              <DropdownMenuRadioItem key={value} value={String(value)} closeOnClick>
                {value}%
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={zoom.resetZoom}>
            <Scan size={15} aria-hidden="true" />
            Reset zoom
            <DropdownMenuShortcut>{modKey}0</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
