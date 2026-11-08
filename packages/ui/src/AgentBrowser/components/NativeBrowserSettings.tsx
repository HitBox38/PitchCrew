import { NativeBrowserProfiles } from './NativeBrowserProfiles.tsx';
import { NativeBrowserPageOptions } from './NativeBrowserPageOptions.tsx';
import { NativeBrowserZoom } from './NativeBrowserZoom.tsx';
import { Settings2, RefreshCcwDot, Eraser } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@pitchcrew/design-system/popover';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { browserShortcut } from '../helpers.ts';
import { BrowserToolsActions } from '@/NativeBrowserTools/components/BrowserToolsActions.tsx';
import type { useNativeBrowserTools } from '@/NativeBrowserTools/hooks/useNativeBrowserTools.ts';
import type { useBrowserDevice } from '@/BrowserDeviceToolbar/useBrowserDevice.ts';

/** Page tools and per-page options as one quiet menu: rows, not a stack of outlined buttons. */
export const NativeBrowserSettings = ({
  model,
  manual,
  tools,
  device,
}: {
  model: NativeBrowserModel;
  manual: boolean;
  tools: ReturnType<typeof useNativeBrowserTools>;
  device: ReturnType<typeof useBrowserDevice>;
}) => (
  <Popover open={tools.settingsOpen} onOpenChange={tools.setSettingsOpen}>
    <PopoverTrigger
      render={
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Browser page settings"
          title="Page settings"
        />
      }
    >
      <Settings2 size={15} />
    </PopoverTrigger>
    <PopoverContent className="browser-settings-menu max-h-[min(80dvh,42rem)] w-72 overflow-y-auto p-1.5 font-sans text-sm">
      <PopoverTitle className="browser-menu-label">Page settings</PopoverTitle>
      <div className="browser-settings-tools">
        <BrowserToolsActions model={tools} device={device} />
      </div>
      <NativeBrowserZoom model={model} manual={manual} />
      <fieldset className="browser-menu-group" aria-label="Page">
        <Button
          className="browser-menu-row"
          size="sm"
          variant="ghost"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'hard-reload' })}
        >
          <RefreshCcwDot size={14} aria-hidden="true" />
          Hard reload
          <kbd aria-hidden="true">{browserShortcut('r', true)}</kbd>
        </Button>
        <Button
          className="browser-menu-row"
          size="sm"
          variant="ghost"
          disabled={!manual}
          onClick={() => void model.command({ kind: 'clear-cache' })}
        >
          <Eraser size={14} aria-hidden="true" />
          Clear cached website files
        </Button>
        <p className="browser-menu-note">Clearing the cache keeps saved sign-ins.</p>
      </fieldset>
      <NativeBrowserPageOptions model={model} manual={manual} />
      <fieldset className="browser-menu-group" aria-label="Browser profile">
        <NativeBrowserProfiles
          key={model.identity!.id}
          id={model.identity!.id}
          disabled={!manual}
          prepare={model.ensure}
          profile={model.state?.profile?.name}
        />
      </fieldset>
    </PopoverContent>
  </Popover>
);
