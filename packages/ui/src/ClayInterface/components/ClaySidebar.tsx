import type { AppSidebarProps } from '@/AppSidebar/types.ts';
import { CrewRoles } from '@/AppSidebar/components/CrewRoles.tsx';
import { RecentJobs } from '@/AppSidebar/components/RecentJobs.tsx';
import { SidebarFooterTray } from '@/AppSidebar/components/SidebarFooterTray.tsx';
import { SidebarStrip } from '@/AppSidebar/components/SidebarStrip.tsx';
import { SetupRow } from '@/AppSidebar/components/SetupRow.tsx';
import { SourceActivity } from '@/components/ProfileSources/components/SourceActivity.tsx';
import { useSidebar } from '@pitchcrew/design-system/sidebar';
import { Sidebar, SidebarContent, SidebarRail } from '@pitchcrew/design-system/sidebar';
import { ConversationNavigationView } from '@/ConversationNavigation/components/ConversationNavigationView.tsx';
import { useClaySidebar } from '../hooks/useClaySidebar.ts';
import { ClayJobs } from './ClayJobs.tsx';
import { ClayNav } from './ClayNav.tsx';

/**
 * Places and conversations use the full sidebar height. Setup and source notices scroll with
 * them; only phones keep queue, updates and Settings in the drawer footer.
 */
export const ClaySidebar = (props: AppSidebarProps) => {
  const sidebar = useClaySidebar(props.data);
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon" aria-label="Pitchcrew" className="clay-sidebar">
      <SidebarStrip />
      <SidebarContent className="sidebar-scroll">
        <ClayNav view={props.view} counts={props.counts} />
        <ClayJobs sidebar={sidebar} onOpenCard={props.onOpenCard} />
        <ConversationNavigationView
          navigation={sidebar.navigation}
          actions={sidebar.actions}
          rows={sidebar.nested.rest}
          empty={sidebar.nested.byCard.size ? 'Job chats are listed under their jobs.' : undefined}
        />
        <RecentJobs recent={props.recent} onOpenCard={props.onOpenCard} />
        <CrewRoles
          data={props.data}
          working={props.working}
          onConfigureRole={props.onConfigureRole}
          onToggleRole={props.onToggleRole}
        />
        <div className="sidebar-notices">
          <SetupRow />
          <div className="sidebar-source-activity" onClickCapture={() => setOpenMobile(false)}>
            <SourceActivity />
          </div>
        </div>
      </SidebarContent>
      <SidebarFooterTray data={props.data} active={props.view === 'settings'} />
      <SidebarRail />
    </Sidebar>
  );
};
