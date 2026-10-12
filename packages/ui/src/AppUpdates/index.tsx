import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Popover, PopoverTrigger } from '@/components/ui/popover/index.tsx';
import { SidebarIconButton } from '@/components/ui/sidebar/components/SidebarIconButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Download, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { UpdateDetails } from './components/UpdateDetails.tsx';
import { useManualUpdateCheck } from './hooks/useManualUpdateCheck.ts';
import { DesktopAppUpdates } from './components/DesktopAppUpdates.tsx';

export function AppUpdates() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const info = useWorkspaceStore((state) => state.appUpdate);
  const dismissed = useWorkspaceStore((state) => state.dismissedAppUpdate);
  const dismiss = useWorkspaceStore((state) => state.dismissAppUpdate);
  const checking = useWorkspaceStore((state) => state.checkingAppUpdate);
  const check = useManualUpdateCheck();
  const native = useWorkspaceStore((state) => state.desktopUpdate?.enabled);
  const disabled = info?.status === 'disabled';
  const available = !!(
    info?.status === 'available' &&
    info.latest &&
    dismissed !== info.latest.commit
  );
  const label = available
    ? 'Pitchcrew update available'
    : checking
      ? 'Checking for updates…'
      : disabled
        ? 'Update checks disabled'
        : 'Check for updates';
  const dismissNotice = () => {
    setOpen(false);
    dismiss();
  };
  if (native) return <DesktopAppUpdates />;
  return (
    <SidebarMenuItem className="ml-auto shrink-0 group-data-[collapsible=icon]:ml-0">
      <Popover open={available && open} onOpenChange={(next) => setOpen(available && next)}>
        <PopoverTrigger
          disabled={!available && (checking || disabled)}
          aria-haspopup={available ? 'dialog' : undefined}
          aria-expanded={available ? open : undefined}
          render={
            <SidebarIconButton
              ref={trigger}
              render={<button type="button" aria-label={label} disabled={!available && disabled} />}
              className={available ? 'sidebar-update-button' : undefined}
              label={label}
              aria-busy={checking}
              aria-disabled={!available && (checking || disabled)}
              onClick={available || checking || disabled ? undefined : () => void check()}
            />
          }
        >
          {available ? (
            <Download aria-hidden="true" />
          ) : (
            <RefreshCw
              aria-hidden="true"
              className={checking ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
          )}
        </PopoverTrigger>
        {info?.latest && (
          <UpdateDetails
            url={info.latest.url}
            dismiss={dismissNotice}
            finalFocus={() => trigger.current}
          />
        )}
      </Popover>
      <output className="sr-only" aria-live="polite">
        {available
          ? 'A newer Pitchcrew build is available.'
          : checking
            ? 'Checking for updates…'
            : ''}
      </output>
    </SidebarMenuItem>
  );
}
