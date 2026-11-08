import { Plus } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { NativeBrowserModel } from '../hooks/useNativeBrowser.ts';
import { browserShortcut } from '../helpers.ts';

/** New tab sits beside the tab list, never inside its scrolling, fading strip. */
export const NativeBrowserNewTab = ({
  model,
  manual,
}: {
  model: NativeBrowserModel;
  manual: boolean;
}) => (
  <Button
    size="icon-sm"
    variant="ghost"
    className="browser-tab-new"
    aria-label="New browser tab"
    title={`New tab (${browserShortcut('t')})`}
    disabled={!manual}
    onClick={() =>
      void model.command({ kind: 'new-tab' }).then(() => {
        const address = document.querySelector<HTMLInputElement>('[aria-label="Browser address"]');
        address?.focus();
        address?.select();
      })
    }
  >
    <Plus size={14} />
  </Button>
);
