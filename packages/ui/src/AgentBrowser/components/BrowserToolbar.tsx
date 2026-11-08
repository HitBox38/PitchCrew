import { RotateCw } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserControl } from '../types.ts';
import { BrowserAddress } from './BrowserAddress.tsx';
import { BrowserZoom } from './BrowserZoom.tsx';
import { BrowserLoadingProgress } from './BrowserLoadingProgress.tsx';
export const BrowserToolbar = ({
  frame,
  control,
  url,
  zoom,
  setZoom,
  panView,
  setPanView,
}: {
  frame: BrowserFrame | null;
  control: BrowserControl;
  url: string;
  zoom: number;
  setZoom: (zoom: number) => void;
  panView: boolean;
  setPanView: (pan: boolean) => void;
}) => {
  const address = frame?.url || url;
  return (
    <div className="browser-toolbar">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Reopen current page"
        title={control.available ? 'Reopen the current address' : 'Take control to navigate'}
        disabled={
          !control.available ||
          control.working ||
          control.inputPending > 0 ||
          !address.startsWith('http')
        }
        onClick={() =>
          // While the agent is idle, reopening is browsing: it takes control first.
          void control.command(async () => {
            const lease = await control.ensure();
            if (lease) control.input({ kind: 'navigate', url: address }, lease);
          })
        }
      >
        <RotateCw size={15} />
      </Button>
      <BrowserAddress frame={frame} control={control} url={address} />
      <BrowserZoom zoom={zoom} setZoom={setZoom} panView={panView} setPanView={setPanView} />
      {frame?.status === 'loading' ? <BrowserLoadingProgress /> : null}
    </div>
  );
};
