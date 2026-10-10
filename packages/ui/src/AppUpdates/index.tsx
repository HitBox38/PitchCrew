import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Popover, PopoverTrigger } from '@/components/ui/popover/index.tsx';
import { SidebarIconButton } from '@/components/ui/sidebar/components/SidebarIconButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import { Download } from 'lucide-react';
import { useRef, type RefObject } from 'react';
import { UpdateDetails } from './components/UpdateDetails.tsx';

export function AppUpdates({
  fallbackFocus,
}: {
  fallbackFocus: RefObject<HTMLAnchorElement | null>;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const info = useWorkspaceStore((state) => state.appUpdate);
  const dismissed = useWorkspaceStore((state) => state.dismissedAppUpdate);
  const dismiss = useWorkspaceStore((state) => state.dismissAppUpdate);
  if (info?.status !== 'available' || !info.latest || dismissed === info.latest.commit) return null;
  return (
    <SidebarMenuItem className="ml-auto shrink-0 group-data-[collapsible=icon]:ml-0">
      <Popover>
        <PopoverTrigger
          render={
            <SidebarIconButton
              ref={trigger}
              className="sidebar-update-button"
              label="Pitchcrew update available"
            />
          }
        >
          <Download aria-hidden="true" />
        </PopoverTrigger>
        <UpdateDetails
          url={info.latest.url}
          dismiss={dismiss}
          finalFocus={() => (trigger.current ? true : fallbackFocus.current)}
        />
      </Popover>
      <output className="sr-only" aria-live="polite">
        A newer Pitchcrew build is available.
      </output>
    </SidebarMenuItem>
  );
}
