import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { BrowserFrame } from '@pitchcrew/core';
import type { BrowserControl } from '../types.ts';
import { BrowserAddress } from './BrowserAddress.tsx';
import { BrowserZoom } from './BrowserZoom.tsx';
export function BrowserToolbar({
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
}) {
  const address = frame?.url || url;
  return (
    <div className="browser-toolbar">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Reopen current page"
        title={control.leaseId ? 'Reopen the current address' : 'Take control to navigate'}
        disabled={!control.leaseId || control.inputPending > 0 || !address.startsWith('http')}
        onClick={() => control.input({ kind: 'navigate', url: address })}
      >
        <RotateCw size={15} />
      </Button>
      <BrowserAddress frame={frame} control={control} url={address} />
      <BrowserZoom zoom={zoom} setZoom={setZoom} panView={panView} setPanView={setPanView} />
    </div>
  );
}
