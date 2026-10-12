import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { SidebarIconButton } from '@/components/ui/sidebar/components/SidebarIconButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Download, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { useManualUpdateCheck } from '../hooks/useManualUpdateCheck.ts';
import { DesktopUpdateActions } from './DesktopUpdateActions.tsx';
import { ReleaseLink } from './ReleaseLink.tsx';

export function DesktopAppUpdates() {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const state = useWorkspaceStore((store) => store.desktopUpdate);
  const info = useWorkspaceStore((store) => store.appUpdate);
  const dismissed = useWorkspaceStore((store) => store.dismissedAppUpdate);
  const dismiss = useWorkspaceStore((store) => store.dismissAppUpdate);
  const check = useManualUpdateCheck();
  if (!state) return null;
  const available = !!state.availableVersion && dismissed !== state.availableVersion;
  const busy = ['checking', 'downloading', 'installing'].includes(state.status);
  const label = available
    ? 'Pitchcrew update available'
    : busy
      ? state.message
      : 'Check for updates';
  return (
    <SidebarMenuItem className="ml-auto shrink-0 group-data-[collapsible=icon]:ml-0">
      <Popover open={available && open} onOpenChange={(next) => setOpen(available && next)}>
        <PopoverTrigger
          disabled={!available && busy}
          render={
            <SidebarIconButton
              ref={trigger}
              render={<button type="button" aria-label={label} />}
              className={available ? 'sidebar-update-button' : undefined}
              label={label}
              aria-busy={busy}
              onClick={available || busy ? undefined : () => void check()}
            />
          }
        >
          {available ? (
            <Download aria-hidden="true" />
          ) : (
            <RefreshCw
              aria-hidden="true"
              className={busy ? 'animate-spin motion-reduce:animate-none' : undefined}
            />
          )}
        </PopoverTrigger>
        <PopoverContent
          className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4"
          finalFocus={() => trigger.current}
        >
          <PopoverTitle className="font-semibold">Pitchcrew update available</PopoverTitle>
          <PopoverDescription className="text-sm text-muted-foreground">
            Version {state.availableVersion}
          </PopoverDescription>
          <DesktopUpdateActions />
          {info?.latest ? <ReleaseLink url={info.latest.url} /> : null}
          <Button
            variant="ghost"
            aria-label="Dismiss update notice"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              dismiss();
            }}
          >
            Dismiss for this session
          </Button>
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}
