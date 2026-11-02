import { Button } from '@pitchcrew/design-system/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
} from '@pitchcrew/design-system/popover';
import { useRef, useState } from 'react';
import { AppUpdateButton } from './components/AppUpdateButton.tsx';
import { UpdateTooltip } from './components/UpdateTooltip.tsx';
import { useUpdateControl } from './hooks/useUpdateControl.ts';

const settingsControl = () =>
  Array.from(document.querySelectorAll<HTMLElement>('.workspace-settings, .sidebar-settings')).find(
    (element) => element.getClientRects().length,
  );

/**
 * A compact update indicator with details and explicit download/restart actions in its popover.
 * Opening the indicator only inspects the update. Manual checks stay in Settings and Search.
 */
export const AppUpdates = () => {
  const control = useUpdateControl();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dismissed = useRef(false);
  if (!control.visible) return null;
  return (
    <div className="app-update">
      <Popover
        open={open}
        onOpenChange={(value) => {
          if (value) dismissed.current = false;
          setOpen(value);
        }}
      >
        <AppUpdateButton control={control} trigger={trigger} />
        <PopoverContent
          className="app-update-panel"
          side="bottom"
          align="end"
          sideOffset={8}
          finalFocus={() =>
            dismissed.current ? (settingsControl() ?? false) : (trigger.current ?? false)
          }
        >
          <PopoverTitle>Pitchcrew update</PopoverTitle>
          <PopoverDescription className="sr-only">
            Release details and update actions
          </PopoverDescription>
          <UpdateTooltip {...control} />
          <footer className="app-update-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={control.busy || control.checking}
              onClick={() => {
                // Dismissal unmounts the indicator, so focus its neighboring Settings control.
                dismissed.current = true;
                setOpen(false);
                control.dismiss();
                settingsControl()?.focus();
              }}
            >
              Dismiss update notice
            </Button>
            <Button size="sm" disabled={control.disabled} onClick={control.activate}>
              {control.label}
            </Button>
          </footer>
        </PopoverContent>
      </Popover>
      <output className="sr-only" aria-live="polite">
        {`${control.label}. ${control.message ?? ''}`}
      </output>
    </div>
  );
};
