import { Button } from '@pitchcrew/design-system/button';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { AppUpdateButton } from './components/AppUpdateButton.tsx';
import { useUpdateControl } from './hooks/useUpdateControl.ts';

/**
 * The sidebar footer's update row, present only while an update is available, downloading or
 * waiting for a restart. Manual checks live in Settings > Updates and the command palette.
 */
export const AppUpdates = () => {
  const control = useUpdateControl();
  const trigger = useRef<HTMLButtonElement>(null);
  if (!control.visible) return null;
  return (
    <div className="sidebar-update-row">
      <AppUpdateButton control={control} trigger={trigger} />
      <Button
        variant="ghost"
        size="icon-sm"
        className="sidebar-update-dismiss"
        aria-label="Dismiss update notice"
        title="Dismiss for this session"
        disabled={control.busy || control.checking}
        onClick={() => {
          control.dismiss();
          // The row unmounts; return focus to the footer's settings control.
          document.querySelector<HTMLElement>('.sidebar-settings')?.focus();
        }}
      >
        <X aria-hidden="true" className="size-3.5" />
      </Button>
      <output className="sr-only" aria-live="polite">
        {`${control.label}. ${control.message ?? ''}`}
      </output>
    </div>
  );
};
