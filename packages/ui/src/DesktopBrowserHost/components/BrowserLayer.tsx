import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { SheetOverlay, SheetTitle } from '@pitchcrew/design-system/sheet';
import type { BrowserSurfaceState } from '../context.ts';

export const BrowserLayer = ({
  surface,
  children,
}: {
  surface: BrowserSurfaceState | null;
  children: ReactNode;
}) => (
  <Dialog.Root
    open={!!surface}
    onOpenChange={(open) => {
      if (!open) surface?.hide();
    }}
  >
    <Dialog.Portal keepMounted>
      {surface ? <SheetOverlay /> : null}
      <Dialog.Popup
        data-desktop-browser-layer=""
        data-expanded={surface ? '' : undefined}
        className="desktop-browser-layer"
        render={(props) => <div {...props} hidden={false} role={surface ? 'dialog' : undefined} />}
        // The address field, never Take control: a stray Space must not pause the agent.
        initialFocus={() =>
          document.querySelector<HTMLElement>(
            '#agent-browser-panel [aria-label="Browser address"]',
          ) ??
          document.querySelector<HTMLElement>('#agent-browser-panel [data-browser-controls] button')
        }
        finalFocus={() =>
          document.querySelector<HTMLButtonElement>('button[aria-controls="agent-browser-panel"]')
        }
      >
        <SheetTitle className="sr-only">{surface?.name ?? 'Agent'}’s browser</SheetTitle>
        <div
          id={surface ? 'agent-browser-panel' : undefined}
          className="agent-browser-panel browser-sheet desktop-browser-chrome"
          hidden={!surface}
        >
          {surface?.children}
        </div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);
