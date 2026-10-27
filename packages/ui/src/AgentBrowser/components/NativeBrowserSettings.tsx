import { NativeBrowserProfiles } from './NativeBrowserProfiles.tsx';
import { Settings2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover/index.tsx';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
export const NativeBrowserSettings = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => {
  const zoom = model.state?.tabs.find((tab) => tab.id === model.state?.activeTab)?.zoomFactor ?? 1;
  const setZoom = (factor: number) => void model.command({ kind: 'zoom', factor });
  return (
    <Popover>
      <PopoverTrigger
        render={<Button size="icon-sm" variant="ghost" aria-label="Browser page settings" />}
      >
        <Settings2 size={15} />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 font-sans text-sm">
        <PopoverTitle>Page settings</PopoverTitle>
        <div className="my-3 flex items-center justify-between gap-2" aria-label="Page zoom">
          <Button
            size="icon-sm"
            aria-label="Zoom out"
            disabled={!manual || zoom <= 0.25}
            onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          >
            <Minus size={14} />
          </Button>
          <output>{Math.round(zoom * 100)}%</output>
          <Button
            size="icon-sm"
            aria-label="Zoom in"
            disabled={!manual || zoom >= 5}
            onClick={() => setZoom(Math.min(5, zoom + 0.25))}
          >
            <Plus size={14} />
          </Button>
          <Button
            size="icon-sm"
            aria-label="Reset page zoom"
            disabled={!manual || zoom === 1}
            onClick={() => setZoom(1)}
          >
            <RotateCcw size={14} />
          </Button>
        </div>
        <Button
          className="w-full"
          size="sm"
          variant="outline"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'hard-reload' })}
        >
          Hard reload
        </Button>
        <Button
          className="mt-2 w-full"
          size="sm"
          variant="outline"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'clear-cache' })}
        >
          Clear cached website files
        </Button>
        <p className="quiet mt-2">Clearing the cache keeps saved sign-ins.</p>
        <p className="quiet mt-2">Profile: {model.state?.profile?.name ?? 'Default'}</p>
        <NativeBrowserProfiles
          key={model.identity!.id}
          id={model.identity!.id}
          disabled={!manual}
        />
      </PopoverContent>
    </Popover>
  );
};
